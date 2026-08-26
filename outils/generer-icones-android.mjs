/* Traduit design/icones/icones.js en table Kotlin.
   La table web reste la source : une icone ajoutee d'un cote se
   retrouve de l'autre, sans recopie a la main.

   Usage : node outils/generer-icones-android.mjs                   */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(racine, 'design/icones/icones.js'), 'utf8');

const paires = [...source.matchAll(/^ {2}([a-z_0-9]+): '\\u([0-9a-f]{4})',$/gm)]
  .map(([, nom, point]) => [nom, point]);

if (paires.length < 50) {
  console.error(`Seulement ${paires.length} icones lues : la table web a-t-elle change de forme ?`);
  process.exit(1);
}

/* snake_case cote web, PascalCase cote Kotlin. */
const enPascal = (nom) => nom.split('_').map((m) => m[0].toUpperCase() + m.slice(1)).join('');

const lignes = paires.map(([nom, point]) => `    val ${enPascal(nom)} = Icone("\\u${point}")`).join('\n');

const kotlin = `package com.essama.dresscode.charte

import androidx.compose.runtime.Immutable

/*
 * Genere par outils/generer-icones-android.mjs — ne pas modifier a la main.
 *
 * Les icones sont les Material Symbols Rounded du kit, sous-ensemblees
 * aux ${paires.length} reellement utilisees. On les adresse par leur point de
 * code et non par leur ligature : le sous-ensemblage elague les regles
 * GSUB de la police, et une ligature perdue afficherait le mot
 * « straighten » a la place du glyphe.
 *
 * Ajouter une icone : la lister dans outils/icones-utilisees.txt,
 * relancer outils/sous-ensembler-icones.mjs puis
 * outils/generer-polices-android.mjs et ce script.
 */

@Immutable
@JvmInline
value class Icone(val glyphe: String)

object Icones {
${lignes}
}
`;

const cible = join(racine, 'android/app/src/main/kotlin/com/essama/dresscode/charte/Icones.kt');
mkdirSync(dirname(cible), { recursive: true });
writeFileSync(cible, kotlin);
console.log(`Icones.kt ecrit — ${paires.length} icones`);
