/* Convertit les polices web du kit en TTF pour les ressources Android.
   ------------------------------------------------------------
   Android ne lit pas le woff2 : c'est un conteneur compresse propre
   au web. La decompression est sans perte — ce sont les memes
   fichiers, donc la meme typographie que la version web, axes
   variables compris.

   Prerequis : python3 -m pip install fonttools brotli
   Usage     : node outils/generer-polices-android.mjs               */

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const dossier = join(racine, 'android/app/src/main/res/font');
mkdirSync(dossier, { recursive: true });

/* Les noms de ressources Android n'acceptent que minuscules,
   chiffres et soulignes. */
const POLICES = [
  ['design/polices/roboto-flex/roboto-flex-latin-full-normal.woff2', 'roboto_flex.ttf'],
  ['design/polices/roboto/roboto-latin-standard-normal.woff2', 'roboto.ttf'],
  ['design/icones/material-symbols-rounded.woff2', 'material_symbols_rounded.ttf'],
];

const ko = (chemin) => `${(statSync(chemin).size / 1024).toFixed(1)} Ko`;

for (const [source, nom] of POLICES) {
  const entree = join(racine, source);
  const sortie = join(dossier, nom);
  execFileSync('python3', [
    '-c',
    `import sys
from fontTools.ttLib import TTFont
police = TTFont(sys.argv[1])
police.flavor = None          # retire l'enveloppe woff2
police.save(sys.argv[2])`,
    entree,
    sortie,
  ]);
  console.log(`${nom.padEnd(32)} ${ko(entree)} -> ${ko(sortie)}`);
}
