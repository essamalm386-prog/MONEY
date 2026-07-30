/**
 * Génère les icônes de lancement Android TDMI à partir des SVG de `web/icons`.
 *
 * Rendu via Chromium (Playwright) — aucune dépendance native. Produit :
 *   - ic_launcher.png / ic_launcher_round.png (icône héritée, fond blanc)
 *   - ic_launcher_foreground.png (calque adaptatif, fond transparent)
 * pour chaque densité mdpi→xxxhdpi.
 *
 * Pour utiliser le logo officiel TDMI : remplacez web/icons/icon.svg (fond
 * blanc) et web/icons/tdmi-foreground.svg (fond transparent) puis relancez
 * `node tools/gen-android-icons.mjs`.
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync, existsSync, globSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RES = join(ROOT, "android/app/src/main/res");

// Densités : [dossier, taille icône héritée, taille foreground adaptatif]
const DENSITIES = [
  ["mdpi", 48, 108],
  ["hdpi", 72, 162],
  ["xhdpi", 96, 216],
  ["xxhdpi", 144, 324],
  ["xxxhdpi", 192, 432],
];

function resolveChromium() {
  for (const p of globSync("/opt/pw-browsers/chromium-*/chrome-linux/chrome")) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

async function renderSvg(page, svgPath, size, transparent) {
  const svg = readFileSync(svgPath, "utf8");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0}
    #b{width:${size}px;height:${size}px;${transparent ? "" : "background:#fff;"}display:flex;align-items:center;justify-content:center}
    svg{width:100%;height:100%;display:block}
  </style></head><body><div id="b">${svg}</div></body></html>`;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html, { waitUntil: "networkidle" });
  return page.locator("#b").screenshot({ omitBackground: transparent });
}

async function main() {
  const iconSvg = join(ROOT, "web/icons/icon.svg");
  const fgSvg = join(ROOT, "web/icons/tdmi-foreground.svg");
  const browser = await chromium.launch({
    executablePath: resolveChromium(),
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  try {
    for (const [dir, legacy, fg] of DENSITIES) {
      const out = join(RES, `mipmap-${dir}`);
      mkdirSync(out, { recursive: true });
      const legacyPng = await renderSvg(page, iconSvg, legacy, false);
      writeFileSync(join(out, "ic_launcher.png"), legacyPng);
      writeFileSync(join(out, "ic_launcher_round.png"), legacyPng);
      const fgPng = await renderSvg(page, fgSvg, fg, true);
      writeFileSync(join(out, "ic_launcher_foreground.png"), fgPng);
      console.log(`✓ ${dir} : ${legacy}px héritée, ${fg}px foreground`);
    }
  } finally {
    await browser.close();
  }
  console.log("Icônes Android TDMI générées.");
}

main().catch((e) => {
  console.error("Échec génération icônes:", e.message);
  process.exit(1);
});
