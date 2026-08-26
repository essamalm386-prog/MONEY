/* Rend app/img/icone.svg en PNG aux tailles attendues par Android
   et iOS. Le SVG reste la source ; ces PNG ne sont la que parce que
   la prise en charge du SVG dans un manifeste reste inegale.

   Usage : node outils/generer-icones-app.mjs                       */

import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = [
  { source: 'icone.svg', prefixe: 'icone' },
  { source: 'icone-masque.svg', prefixe: 'icone-masque' },
];

/* Le navigateur preinstalle de l'environnement peut ne pas
   correspondre a la version que Playwright attend. */
const preinstalle = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const navigateur = await chromium.launch(
  existsSync(preinstalle) ? { executablePath: preinstalle } : {},
);
for (const { source, prefixe } of SOURCES) {
  const svg = readFileSync(join(racine, 'app/img', source), 'utf8');
  for (const taille of [192, 512]) {
    const page = await navigateur.newPage({ viewport: { width: taille, height: taille } });
    await page.setContent(
      `<body style="margin:0">${svg.replace('<svg', `<svg width="${taille}" height="${taille}"`)}</body>`,
    );
    const cible = `app/img/${prefixe}-${taille}.png`;
    writeFileSync(join(racine, cible), await page.screenshot({ omitBackground: true }));
    await page.close();
    console.log(cible);
  }
}
await navigateur.close();
