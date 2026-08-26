# Charte graphique

## Material Design 3 Expressive — règles d'usage

Ce document dit **comment** utiliser le kit. Il est volontairement prescriptif : les règles ci-dessous sont celles qui font la différence entre une interface qui a l'air construite et une interface qui a l'air assemblée.

---

## 1. Couleur

### Le principe : tu ne choisis qu'une couleur

Tu donnes ta couleur de marque au générateur, l'algorithme HCT de Google produit les 29 rôles. Ce n'est pas un gadget : HCT (Hue, Chroma, Tone) est un espace colorimétrique conçu pour que le **ton** corresponde à la luminance perçue. C'est ce qui garantit que `on-primary` sur `primary` respecte les contrastes, quelle que soit la couleur de départ.

**Ne choisis jamais une couleur d'interface à la main.** Utilise un rôle.

### Comment fonctionnent les rôles

Les rôles vont par paires : une couleur de fond et sa couleur de contenu.

| Fond | Contenu à poser dessus |
|---|---|
| `--md-sys-color-primary` | `--md-sys-color-on-primary` |
| `--md-sys-color-primary-container` | `--md-sys-color-on-primary-container` |
| `--md-sys-color-surface` | `--md-sys-color-on-surface` |
| `--md-sys-color-error` | `--md-sys-color-on-error` |

**La règle absolue :** si tu poses `primary` en fond, le texte dessus est `on-primary`. Jamais autre chose. Le contraste est garanti par construction — dès que tu t'en écartes, il ne l'est plus.

### Quand utiliser quoi

| Rôle | Usage | Fréquence |
|---|---|---|
| `primary` | L'action principale, une par écran | Rare, donc fort |
| `primary-container` | Zones mises en avant, sélection | Moyen |
| `secondary-container` | Chips actifs, indicateur de nav, accents | Moyen |
| `tertiary-container` | Accent de contraste, succès, catégorisation | Rare |
| `surface` | Le fond général | Partout |
| `surface-variant` | Séparation douce de zones | Fréquent |
| `outline` | Bordures de champs, séparateurs marqués | Fréquent |
| `outline-variant` | Séparateurs discrets | Fréquent |
| `error` | Erreurs uniquement | Rare, jamais décoratif |

### Les erreurs à ne pas commettre

**Ne pas saturer.** Une interface où tout est en `primary` n'a plus de hiérarchie. La couleur principale doit rester rare pour rester lisible comme signal.

**Ne pas utiliser `error` comme couleur décorative.** Le rouge doit vouloir dire « quelque chose ne va pas ». S'il sert aussi de couleur d'accent, il ne veut plus rien dire.

**Ne pas coder les couleurs en dur.** `#0052dc` cassera en mode sombre. `var(--md-sys-color-primary)` non.

### Mode sombre

Le kit gère trois états :

- **Préférence système** (par défaut) — via `prefers-color-scheme`
- **Forcé clair** — `<html data-theme="light">`
- **Forcé sombre** — `<html data-theme="dark">`

Si tu n'utilises que des variables, tu n'as **rien** à écrire pour le mode sombre : il fonctionne déjà.

---

## 2. Typographie

### Les cinq familles et leur rôle

| Famille | Variable | Usage |
|---|---|---|
| Roboto Flex | `--md-sys-typescale-font-brand` | Titres, identité |
| Roboto | `--md-sys-typescale-font-plain` | Texte courant, interface |
| Roboto Serif | `--md-sys-typescale-font-serif` | Contenus longs, articles |
| Roboto Mono | `--md-sys-typescale-font-mono` | Code, montants, colonnes chiffrées |
| Roboto Condensed | `--md-sys-typescale-font-condensed` | Espaces contraints |

**Deux familles maximum par projet.** L'usage standard : Roboto Flex pour les titres, Roboto pour le reste. Roboto Mono s'ajoute uniquement si tu affiches du code ou des chiffres en colonnes.

### L'échelle à 15 styles

Elle se décline en trois familles de tailles, chacune en large/medium/small :

- **Display** (57 / 45 / 36) — les grands moments : page d'accueil, chiffre clé, état vide. Rare.
- **Headline** (32 / 28 / 24) — titres de page et de section.
- **Title** (22 / 16 / 14) — titres de carte, de dialogue, en-têtes.
- **Body** (16 / 14 / 12) — le texte courant. `body-large` est le défaut.
- **Label** (14 / 12 / 11) — libellés de boutons, de champs, de chips.

Les classes prêtes sont dans `polices.css` : `.md-headline-large`, `.md-body-medium`, etc.

**N'invente pas de taille intermédiaire.** Si 22px te semble trop grand et 16px trop petit, le problème est presque toujours la hiérarchie, pas la taille.

### Chiffres alignés

Pour tout tableau de montants, active les chiffres tabulaires :

```css
.montant { font-variant-numeric: tabular-nums; text-align: right; }
```

La classe `.md-table-numeric` le fait déjà. Sans ça, les colonnes de chiffres ne s'alignent pas verticalement.

---

## 3. Espacement

### La grille de 4px

Toutes les valeurs sont des multiples de 4. C'est ce qui produit le rythme visuel régulier.

| Token | Valeur | Usage typique |
|---|---|---|
| `--md-sys-spacing-1` | 4px | Micro-écarts, icône/texte serré |
| `--md-sys-spacing-2` | 8px | Icône ↔ libellé |
| `--md-sys-spacing-3` | 12px | Écarts internes serrés |
| `--md-sys-spacing-4` | 16px | Padding de composant |
| `--md-sys-spacing-5` | 20px | Écart entre éléments liés |
| `--md-sys-spacing-6` | **24px** | **Padding de carte, gouttière — le défaut** |
| `--md-sys-spacing-8` | 32px | Séparation de blocs |
| `--md-sys-spacing-12` | 48px | Séparation de sections |
| `--md-sys-spacing-16` | 64px | Respiration de page |

**En cas de doute, prends 24px.** C'est la valeur par défaut de Material 3 Expressive, et l'un des changements majeurs par rapport au Material Design classique, plus compact.

### La règle de proximité

L'écart entre deux éléments doit refléter leur lien. Deux éléments liés se rapprochent, deux éléments distincts s'éloignent. Un titre collé à son paragraphe et séparé du bloc suivant se lit sans effort ; des écarts uniformes partout obligent le lecteur à deviner la structure.

---

## 4. Formes et rayons

| Token | Valeur | Usage |
|---|---|---|
| `--md-sys-shape-xs` | 4px | Champs de saisie |
| `--md-sys-shape-sm` | 8px | Chips, petits éléments |
| `--md-sys-shape-md` | 12px | Alertes, éléments de liste |
| `--md-sys-shape-lg` | 16px | FAB, conteneurs moyens |
| `--md-sys-shape-xl` | **24px** | **Cartes — le défaut Expressive** |
| `--md-sys-shape-2xl` | 32px | Dialogues, grandes surfaces |
| `--md-sys-shape-full` | 9999px | Boutons, badges, indicateurs |

**Les boutons sont entièrement arrondis** dans Material 3 Expressive, pas à 8px. C'est un marqueur fort du style : c'est ce qui donne le ton chaleureux plutôt que corporate.

**Cohérence d'échelle :** un petit élément dans un grand conteneur doit avoir un rayon plus petit. Un rayon de 24px sur un chip de 32px de haut le transforme en pilule mal formée.

---

## 5. Iconographie

### Un seul style, partout

Rounded, Outlined ou Sharp — choisis-en un et ne le change jamais en cours de projet. **Rounded** est cohérent avec les rayons généreux de la charte.

### Les quatre axes — la clé du rendu

C'est ici que se joue « joli / pas joli ».

| Axe | Règle |
|---|---|
| `opsz` | **Doit égaler la taille de rendu.** L'erreur n°1. |
| `wght` | **Doit matcher la graisse du texte voisin.** |
| `GRAD` | **~25 en mode sombre** pour compenser l'irradiation optique. |
| `FILL` | **0 → 1** pour les états actifs. |

Les classes `.md-icon-20`, `.md-icon-24`, `.md-icon-40`, `.md-icon-48` règlent `opsz` automatiquement. Utilise-les plutôt qu'un `font-size` brut.

### Tailles

| Contexte | Taille |
|---|---|
| Dans un texte, un chip, un badge | 20px |
| **Interface par défaut** | **24px** |
| Carte, en-tête de section | 40px |
| État vide, illustration | 48px |

Ne mets jamais une icône à 17px ou 31px : les traits deviennent flous.

### Alignement

```html
<span class="md-icon-label">
  <span class="material-symbols-rounded" aria-hidden="true">check</span>
  Terminé
</span>
```

`inline-flex` + `align-items: center` + `gap: 8px`. Ne jamais utiliser `vertical-align: middle` sur une icône de police : le résultat dépend de la fonte du texte.

### Accessibilité

Icône décorative (le texte à côté dit déjà la même chose) :
```html
<span class="material-symbols-rounded" aria-hidden="true">save</span> Enregistrer
```

Icône seule et cliquable :
```html
<button class="md-icon-btn" aria-label="Fermer">
  <span class="material-symbols-rounded" aria-hidden="true">close</span>
</button>
```

### Cohérence sémantique

Une icône = un sens, dans tout le projet. Tenir une liste de correspondance dès le début évite de découvrir trois mois plus tard que la même icône veut dire deux choses différentes selon l'écran.

---

## 6. Élévation

Cinq niveaux, de 0 à 5. L'élévation exprime la **hiérarchie de plan**, pas la décoration.

| Niveau | Usage |
|---|---|
| 0 | Surfaces à plat, contenu normal |
| 1 | Cartes au repos |
| 2 | Cartes survolées, barres d'app |
| 3 | FAB, dialogues, menus |
| 4-5 | Éléments en cours de déplacement |

**Ne pas empiler les ombres.** Deux éléments élevés imbriqués produisent une bouillie visuelle. Dans Material 3, la hiérarchie passe d'abord par la couleur de surface, l'ombre n'est qu'un renfort.

---

## 7. Motion

### Durées

| Catégorie | Plage | Usage |
|---|---|---|
| Short | 50–200ms | Survol, focus, petits changements d'état |
| Medium | 250–400ms | Apparition d'éléments, transitions de composants |
| Long | 450–600ms | Transitions de page |
| Extra-long | 700–1000ms | Séquences complexes, animations d'accueil |

Material 3 Expressive est **plus lent** que Material Design classique : 200ms là où l'ancien standard mettait 150ms. C'est délibéré — c'est ce qui produit la sensation fluide plutôt que sèche.

### Courbes

| Courbe | Usage |
|---|---|
| `standard` | La plupart des transitions |
| `emphasized-decelerate` | Entrée d'un élément (arrive vite, s'installe doucement) |
| `emphasized-accelerate` | Sortie d'un élément |

**Ne jamais animer avec `linear`**, sauf pour une rotation continue (spinner). Le mouvement linéaire paraît mécanique.

### Ce qu'on n'anime pas

N'anime pas `width`, `height`, `top`, `left` : ces propriétés déclenchent un recalcul de mise en page à chaque image. Anime `transform` et `opacity`, qui sont traitées par le compositeur.

### Mouvement réduit

`composants.css` respecte déjà `prefers-reduced-motion`. Si tu écris des animations personnalisées, garde ce garde-fou.

---

## 8. Accessibilité

Le kit couvre déjà une partie, mais ces points restent de ta responsabilité :

**Contraste** — garanti par les paires de rôles. Il redevient ton problème dès que tu codes une couleur en dur.

**Cibles tactiles** — 48 × 48px minimum. Les boutons du kit font 40px de haut avec une zone cliquable étendue ; sur mobile, vérifie l'espacement entre cibles adjacentes.

**Focus visible** — jamais de `outline: none` sans remplacement. Le kit utilise `:focus-visible` avec un contour de 3px.

**La couleur ne doit jamais être le seul signal.** Un champ en erreur doit avoir une bordure rouge **et** un message texte. Environ 8 % des hommes ont une déficience de la vision des couleurs.

**Hiérarchie des titres** — un seul `<h1>` par page, pas de niveau sauté. Les classes typographiques sont indépendantes du niveau sémantique : un `<h2>` peut porter `.md-headline-small` sans problème.

---

## 9. Points de rupture

| Token | Largeur | Cible |
|---|---|---|
| `compact` | 0px | Téléphone portrait |
| `medium` | 600px | Tablette portrait, téléphone paysage |
| `expanded` | 840px | Tablette paysage, petit portable |
| `large` | 1200px | Ordinateur |
| `extra-large` | 1600px | Grand écran |

Conçois d'abord en `compact`, puis élargis. L'inverse produit presque toujours des interfaces mobiles qui semblent amputées.

---

## 10. Checklist avant livraison

- [ ] Aucune couleur codée en dur — que des `var(--md-sys-color-*)`
- [ ] Mode sombre testé sur chaque écran
- [ ] Un seul style d'icône dans tout le projet
- [ ] `opsz` aligné sur la taille de rendu de chaque icône
- [ ] Espacements sur la grille de 4px
- [ ] Une seule action `primary` par écran
- [ ] Icônes décoratives en `aria-hidden="true"`
- [ ] Icônes seules cliquables avec `aria-label`
- [ ] Focus visible sur tous les éléments interactifs
- [ ] Aucune information transmise par la couleur seule
- [ ] Cibles tactiles ≥ 48px sur mobile
- [ ] `prefers-reduced-motion` respecté

---

## Sources

- [Material Design 3](https://m3.material.io) — spécification complète
- [Design tokens](https://m3.material.io/foundations/design-tokens) — nomenclature officielle
- [Material Symbols](https://developers.google.com/fonts/docs/material_symbols) — axes variables
- [material-color-utilities](https://github.com/material-foundation/material-color-utilities) — algorithme HCT
- [Expressive Material Design](https://design.google/library/expressive-material-design-google-research) — recherche UX Google
