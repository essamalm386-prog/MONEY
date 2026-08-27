/* Traduit design/tokens/tokens.css en un ColorScheme Compose.
   ------------------------------------------------------------
   Une seule source de verite pour la charte : le fichier de jetons
   genere par l'algorithme HCT. Recopier les 29 roles a la main dans
   du Kotlin garantirait qu'ils divergent au premier changement de
   couleur de marque.

   Usage : node outils/generer-theme-compose.mjs                    */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(racine, 'design/tokens/tokens.css'), 'utf8');

/* Les roles clairs sont dans la regle :root, les sombres dans le
   bloc [data-theme="dark"] — le meme que celui que sert le media
   query, sans avoir a analyser ce dernier. */
const bloc = (debut) => {
  const index = css.indexOf(debut);
  if (index === -1) throw new Error(`Bloc introuvable : ${debut}`);
  return css.slice(index, css.indexOf('\n}', index));
};

const roles = (texte) =>
  Object.fromEntries(
    [...texte.matchAll(/--md-sys-color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)]
      .map(([, nom, valeur]) => [nom, valeur]),
  );

const clair = roles(bloc(':root {'));
const sombre = roles(bloc(':root[data-theme="dark"] {'));

/* Material 3 dans Compose ne connait pas tous les roles du kit :
   on ne traduit que ceux que ColorScheme accepte. */
const CORRESPONDANCE = {
  primary: 'primary',
  'on-primary': 'onPrimary',
  'primary-container': 'primaryContainer',
  'on-primary-container': 'onPrimaryContainer',
  secondary: 'secondary',
  'on-secondary': 'onSecondary',
  'secondary-container': 'secondaryContainer',
  'on-secondary-container': 'onSecondaryContainer',
  tertiary: 'tertiary',
  'on-tertiary': 'onTertiary',
  'tertiary-container': 'tertiaryContainer',
  'on-tertiary-container': 'onTertiaryContainer',
  error: 'error',
  'on-error': 'onError',
  'error-container': 'errorContainer',
  'on-error-container': 'onErrorContainer',
  background: 'background',
  'on-background': 'onBackground',
  surface: 'surface',
  'on-surface': 'onSurface',
  'surface-variant': 'surfaceVariant',
  'on-surface-variant': 'onSurfaceVariant',
  outline: 'outline',
  'outline-variant': 'outlineVariant',
  scrim: 'scrim',
  'inverse-surface': 'inverseSurface',
  'inverse-on-surface': 'inverseOnSurface',
  'inverse-primary': 'inversePrimary',
};

const kotlinCouleur = (hex) => `Color(0xFF${hex.slice(1).toUpperCase()})`;

const schema = (source, nom, fabrique) => {
  const lignes = Object.entries(CORRESPONDANCE)
    .filter(([cle]) => source[cle])
    .map(([cle, propriete]) => `    ${propriete} = ${kotlinCouleur(source[cle])},`)
    .join('\n');
  return `private val ${nom} = ${fabrique}(\n${lignes}\n)`;
};

const source = css.match(/Couleur de marque : (#[0-9a-f]{6})/i)?.[1] || 'inconnue';

const sortie = `package com.essama.dresscode.charte

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

/*
 * Genere par outils/generer-theme-compose.mjs — ne pas modifier a la main.
 *
 * Les 29 roles viennent de design/tokens/tokens.css, produit par
 * l'algorithme HCT de Google a partir de la couleur de marque ${source}.
 * Les contrastes sont garantis par construction tant qu'on pose
 * « onX » sur « X » : ne jamais choisir une couleur a la main.
 */

${schema(clair, 'ClairSchema', 'lightColorScheme')}

${schema(sombre, 'SombreSchema', 'darkColorScheme')}

internal val schemaClair: ColorScheme = ClairSchema
internal val schemaSombre: ColorScheme = SombreSchema
`;

const cible = join(racine, 'android/app/src/main/kotlin/com/essama/dresscode/charte/Couleurs.kt');
mkdirSync(dirname(cible), { recursive: true });
writeFileSync(cible, sortie);
console.log(`Couleurs.kt ecrit — ${Object.keys(CORRESPONDANCE).length} roles, marque ${source}`);
