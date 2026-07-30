/**
 * Capture les écrans de la PWA (format téléphone) pour contrôle visuel.
 * Usage : node tools/screenshots.mjs [baseUrl] [dossierSortie]
 */
import { chromium } from "playwright";
import { existsSync, globSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] || "http://127.0.0.1:3000";
const OUT = process.argv[3] || "/tmp/shots";

function resolveChromium() {
  for (const p of globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome")) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

const TABS = [
  ["accueil", "Accueil"],
  ["pointage", "Pointage"],
  ["equipe", "Équipe"],
  ["rapports", "Rapports"],
  ["profil", "Profil"],
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: resolveChromium(),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const page = await browser.newPage({ viewport: { width: 400, height: 880 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text()));

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  // Cale la date sur le jeu de démonstration.
  await page.evaluate(() => localStorage.setItem("demoDate", "1"));
  await page.waitForTimeout(600);

  for (const [tab, label] of TABS) {
    await page.click(`.tabbar button[data-tab="${tab}"]`);
    await page.waitForTimeout(450);
    const file = join(OUT, `${tab}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${label} → ${file}`);
  }

  if (errors.length) {
    console.log("\n⚠️ Erreurs JS détectées :");
    for (const e of [...new Set(errors)]) console.log("  " + e);
  } else {
    console.log("\n✅ Aucune erreur JS.");
  }
  await browser.close();
}

main().catch((e) => {
  console.error("Échec capture:", e.message);
  process.exit(1);
});
