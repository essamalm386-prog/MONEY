/* Rend les icones de app/img/*.svg en PNG, pour le web et pour
   Android. Le SVG reste la source ; ces PNG existent parce que la
   prise en charge du SVG reste inegale dans un manifeste web, et
   inexistante dans les ressources Android.

   Usage : node outils/generer-icones-app.mjs                       */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Icones du manifeste web. */
const WEB = [
  { source: 'icone.svg', prefixe: 'icone', tailles: [192, 512] },
  { source: 'icone-masque.svg', prefixe: 'icone-masque', tailles: [192, 512] },
];

/* Densites Android. Une icone de lanceur fait 48 dp ; une icone
   adaptative fait 108 dp, dont seuls les 72 dp centraux sont
   toujours visibles. */
const DENSITES = [
  ['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4],
];
const ANDROID = [
  { source: 'icone.svg', nom: 'ic_launcher', dp: 48 },
  { source: 'icone-ronde.svg', nom: 'ic_launcher_round', dp: 48 },
  { source: 'icone-premier-plan.svg', nom: 'ic_launcher_foreground', dp: 108 },
];

const preinstalle = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const navigateur = await chromium.launch(existsSync(preinstalle) ? { executablePath: preinstalle } : {});

const rendre = async (svg, taille, cible) => {
  const page = await navigateur.newPage({ viewport: { width: taille, height: taille } });
  await page.setContent(
    `<body style="margin:0">${svg.replace('<svg', `<svg width="${taille}" height="${taille}"`)}</body>`,
  );
  mkdirSync(dirname(cible), { recursive: true });
  writeFileSync(cible, await page.screenshot({ omitBackground: true }));
  await page.close();
};

for (const { source, prefixe, tailles } of WEB) {
  const svg = readFileSync(join(racine, 'app/img', source), 'utf8');
  for (const taille of tailles) {
    const cible = `app/img/${prefixe}-${taille}.png`;
    await rendre(svg, taille, join(racine, cible));
    console.log(cible);
  }
}

for (const { source, nom, dp } of ANDROID) {
  const svg = readFileSync(join(racine, 'app/img', source), 'utf8');
  for (const [densite, facteur] of DENSITES) {
    const cible = `android/app/src/main/res/mipmap-${densite}/${nom}.png`;
    await rendre(svg, Math.round(dp * facteur), join(racine, cible));
    console.log(cible);
  }
}

await navigateur.close();
