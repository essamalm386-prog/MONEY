/* Regenere design/tokens/tokens.css a partir de la couleur de marque.
   Moteur : material-color-utilities (algorithme HCT de Google).
   Usage : node outils/generer-tokens.mjs [#rrggbb]                     */

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..');

/* Le bundle de Google est une IIFE qui pose la variable globale MCU. */
const contexte = { console };
vm.createContext(contexte);
vm.runInContext(readFileSync(join(ici, 'material-color-utilities.min.js'), 'utf8'), contexte);
const { themeFromSourceColor, argbFromHex, hexFromArgb } = contexte.MCU;

const COULEUR_MARQUE = process.argv[2] || '#3f3d9e';
const TONS = [0, 4, 6, 10, 12, 17, 20, 22, 24, 30, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100];
const PALETTES = ['primary', 'secondary', 'tertiary', 'neutral', 'neutralVariant', 'error'];
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const theme = themeFromSourceColor(argbFromHex(COULEUR_MARQUE));
const roles = (schema, indent) =>
  Object.entries(schema.toJSON())
    .map(([cle, valeur]) => `${indent}--md-sys-color-${kebab(cle)}: ${hexFromArgb(valeur)};`)
    .join('\n');

const palettes = PALETTES.map((p) =>
  TONS.map((t) => `  --md-ref-palette-${kebab(p)}-${t}: ${hexFromArgb(theme.palettes[p].tone(t))};`).join('\n'),
).join('\n\n');

const horsCouleur = readFileSync(join(ici, 'tokens-hors-couleur.css'), 'utf8').trimEnd();

const css = `/* ============================================================
   DRESS CODE — jetons de design
   Material Design 3 Expressive, genere avec material-color-utilities
   (algorithme HCT de Google). Couleur de marque : ${COULEUR_MARQUE}

   Ne modifie pas ce fichier a la main.
   Pour changer la charte : node outils/generer-tokens.mjs #rrggbb
   ============================================================ */

:root {
  /* ---------- Roles de couleur (mode clair) ---------- */
${roles(theme.schemes.light, '  ')}

  /* ---------- Palettes tonales completes ---------- */
${palettes}

${horsCouleur}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${roles(theme.schemes.dark, '    ')}
  }
}

:root[data-theme="dark"] {
${roles(theme.schemes.dark, '  ')}
}
`;

writeFileSync(join(racine, 'design/tokens/tokens.css'), css);
console.log(`design/tokens/tokens.css ecrit — couleur de marque ${COULEUR_MARQUE}`);
