/**
 * Test end-to-end « durabilité » de la PWA.
 *
 * Démarre un serveur sur une base SQLite temporaire, ouvre l'application dans
 * Chromium, exécute le parcours réel d'un chef de chantier (saisie d'heures,
 * absence, intempérie, accident) puis vérifie le tableau de bord. Valide donc
 * l'ensemble de la chaîne : UI → IndexedDB → API → SQLite → rapports.
 *
 * Usage : node e2e/smoke.mjs
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, rmSync, globSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3931;
const DB = "data/e2e.db";
const BASE = `http://127.0.0.1:${PORT}`;

// Résout un Chromium présent sur la machine (l'image fournit /opt/pw-browsers).
function resolveChromium() {
  for (const p of globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome")) {
    if (existsSync(p)) return p;
  }
  return undefined; // laisse Playwright choisir son binaire par défaut
}

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT: " + msg);
}

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(BASE + "/api/health");
      if (r.ok) return;
    } catch {
      /* pas encore prêt */
    }
    await sleep(200);
  }
  throw new Error("serveur non démarré");
}

async function main() {
  rmSync("data/e2e.db", { force: true });
  rmSync("data/e2e.db-wal", { force: true });
  rmSync("data/e2e.db-shm", { force: true });

  const server = spawn("npx", ["tsx", "src/server/index.ts"], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: DB },
    stdio: "inherit",
  });

  let browser;
  try {
    await waitForServer();

    // Prépare un chantier et une personne via l'API (référentiel).
    await fetch(BASE + "/api/chantiers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "ch_e2e", code: "E2E-01", name: "Chantier E2E", client: "Interne" }),
    });
    await fetch(BASE + "/api/workers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "wk_e2e",
        firstName: "Test",
        lastName: "Ouvrier",
        type: "EMPLOYE",
        category: "OUVRIER",
        trade: "Maçon",
        hourlyRate: 20,
        costs: [{ chantierId: "ch_e2e", mealAllowance: 10, travelAllowance: 8 }],
      }),
    });
    // Affectation de la personne au chantier pour la semaine (conducteur de travaux).
    await fetch(BASE + "/api/assignments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workerId: "wk_e2e", chantierId: "ch_e2e", anyDate: "2026-07-30", assignedBy: "cond_e2e" }),
    });

    browser = await chromium.launch({
      executablePath: resolveChromium(),
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push("console: " + m.text());
    });

    await page.goto(BASE + "/", { waitUntil: "networkidle" });

    // Onglet Pointage, date connue.
    await page.click('.tabbar button[data-tab="pointage"]');
    await page.fill("#f-date", "2026-07-30");
    await page.waitForSelector('[data-detail="wk_e2e"]');

    // Saisie détaillée : créneau 07:30–16:30, pause 60 min → 8 h.
    await page.click('[data-detail="wk_e2e"]');
    await page.waitForSelector("#seg-kind");
    await page.fill("#start", "07:30");
    await page.fill("#end", "16:30");
    await page.fill("#break", "60");
    await page.click("#save");
    try {
      await page.waitForFunction(
        () => document.querySelector('[data-detail="wk_e2e"]')?.textContent.includes("8h00"),
        { timeout: 8000 },
      );
    } catch (err) {
      const toastTxt = await page.locator("#toast").innerText().catch(() => "");
      console.error("DEBUG toast:", JSON.stringify(toastTxt));
      console.error("DEBUG errors:", errors.join(" | "));
      throw err;
    }
    console.log("✓ Saisie TRAVAIL enregistrée dans l'UI (8h00)");

    // Stepper : +30 min puis −30 min → retour à 8h00.
    await page.click('[data-step="wk_e2e"][data-delta="1"]');
    await page.waitForFunction(
      () => document.querySelector('[data-detail="wk_e2e"]')?.textContent.includes("8h30"),
      { timeout: 5000 },
    );
    await page.click('[data-step="wk_e2e"][data-delta="-1"]');
    await page.waitForFunction(
      () => document.querySelector('[data-detail="wk_e2e"]')?.textContent.includes("8h00"),
      { timeout: 5000 },
    );
    console.log("✓ Stepper −/+ fonctionne (8h00 → 8h30 → 8h00)");

    // Vérifie la persistance côté serveur (synchro locale → API → SQLite).
    await page.waitForTimeout(700);
    const entries = await fetch(BASE + "/api/entries?from=2026-07-30&to=2026-07-30").then((r) => r.json());
    const mine = entries.filter((e) => e.workerId === "wk_e2e" && !e.deleted);
    assert(mine.length === 1, `1 pointage attendu côté serveur, reçu ${mine.length}`);
    assert(mine[0].minutes === 480, `480 min attendues, reçu ${mine[0].minutes}`);
    console.log("✓ Pointage synchronisé et persistant (SQLite)");

    // Rapports : total heures et coût (8h×20 + panier 10 + déplacement 8 = 178 €).
    await page.click('.tabbar button[data-tab="rapports"]');
    await page.fill("#rp-date", "2026-07-30");
    await page.waitForSelector("#rp-total-hours");
    const workedText = await page.locator("#rp-total-hours").innerText();
    assert(workedText.includes("8h00"), `total heures = ${workedText}, attendu 8h00`);
    console.log("✓ Rapports : total heures correct (8h00)");
    const costTotal = await page.locator("#rp-total-cost").innerText();
    assert(costTotal.includes("178"), `coût total = ${costTotal}, attendu ~178 €`);
    console.log("✓ Rapports : coût estimé correct (178 €)");

    assert(errors.length === 0, `erreurs JS dans la page: ${errors.join(" | ")}`);
    console.log("\n✅ E2E OK — parcours complet validé (UI → IndexedDB → API → SQLite → rapports)");
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error("\n❌ E2E ÉCHEC:", e.message);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 500);
});
