/* Reduit material-symbols-rounded.woff2 aux seules icones listees dans
   outils/icones-utilisees.txt, et ecrit la table nom -> caractere que
   l'application utilise pour poser une icone.

   Pourquoi : la police complete pese 5,3 Mo. Le produit vise des telephones
   d'entree de gamme sur reseau mobile lent ; charger 5 Mo d'icones dont on
   utilise 1,5 % contredit la promesse « ouvre et vois ta journee ».
   Le sous-ensemble garde les quatre axes variables (FILL, wght, GRAD, opsz)
   exiges par la charte graphique.

   On adresse les icones par leur point de code plutot que par leur ligature :
   le sous-ensemblage elague les regles GSUB de la police, et une ligature
   perdue afficherait le mot « straighten » a la place du glyphe.

   Prerequis : python3 -m pip install fonttools brotli
   Usage     : node outils/sous-ensembler-icones.mjs [chemin/police.woff2] */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..');
const source = process.argv[2] || join(ici, 'material-symbols-rounded.woff2');
const sortie = join(racine, 'design/icones/material-symbols-rounded.woff2');
const table = join(racine, 'design/icones/icones.js');

if (!existsSync(source)) {
  console.error(`Police source introuvable : ${source}`);
  console.error('Passe le chemin de material-symbols-rounded.woff2 en argument.');
  process.exit(1);
}

const noms = readFileSync(join(ici, 'icones-utilisees.txt'), 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

/* Point de code de chaque glyphe, lu directement dans la cmap de la police. */
const parNom = JSON.parse(
  execFileSync('python3', [
    '-c',
    `import json,sys
from fontTools.ttLib import TTFont
cmap = TTFont(sys.argv[1]).getBestCmap()
par_nom = {}
for point, glyphe in cmap.items():
    par_nom.setdefault(glyphe, []).append(point)
print(json.dumps({g: min(p) for g, p in par_nom.items()}))`,
    source,
  ]).toString(),
);

const introuvables = noms.filter((n) => parNom[n] === undefined);
if (introuvables.length) {
  console.error(`Icones inconnues de la police : ${introuvables.join(', ')}`);
  process.exit(1);
}

const points = noms.map((n) => parNom[n]);

execFileSync(
  'python3',
  [
    '-m', 'fontTools.subset', source,
    `--unicodes=${points.map((p) => `U+${p.toString(16).toUpperCase()}`).join(',')}`,
    '--layout-features=',
    '--flavor=woff2',
    '--no-hinting',
    `--output-file=${sortie}`,
  ],
  { stdio: 'inherit' },
);

const lignes = noms
  .map((n) => `  ${n}: '\\u${parNom[n].toString(16).padStart(4, '0')}',`)
  .join('\n');

writeFileSync(
  table,
  `/* Genere par outils/sous-ensembler-icones.mjs — ne pas modifier a la main.
   Table nom d'icone Material Symbols -> caractere dans la police
   sous-ensemblee. Ajouter une icone : la lister dans
   outils/icones-utilisees.txt puis relancer le script. */

export const ICONES = {
${lignes}
};

/* Rend une icone. Decorative par defaut : le texte a cote dit deja la
   meme chose. Passer { titre } uniquement quand l'icone est seule
   porteuse de sens. */
export function icone(nom, { taille = 24, classe = '', pleine = false, titre = '' } = {}) {
  const glyphe = ICONES[nom];
  if (!glyphe) throw new Error(\`Icone absente du sous-ensemble : \${nom}\`);
  const classes = ['material-symbols-rounded', \`md-icon-\${taille}\`];
  if (pleine) classes.push('md-icon-filled');
  if (classe) classes.push(classe);
  const acces = titre ? \`role="img" aria-label="\${titre}"\` : 'aria-hidden="true"';
  return \`<span class="\${classes.join(' ')}" \${acces}>\${glyphe}</span>\`;
}
`,
);

const ko = (f) => `${(statSync(f).size / 1024).toFixed(1)} Ko`;
console.log(`${noms.length} icones — ${ko(source)} -> ${ko(sortie)}`);
console.log(`table ecrite : design/icones/icones.js`);
