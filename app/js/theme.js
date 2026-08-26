/* ============================================================
   THEME — trois etats, aucune couleur a ecrire
   ------------------------------------------------------------
   tokens.css gere deja les trois cas : preference systeme,
   force clair, force sombre. Ce fichier ne fait que poser
   l'attribut sur la racine et retenir le choix.
   ============================================================ */

const CLE = 'dress-code-theme';

export function themeCourant() {
  return document.documentElement.dataset.theme || 'auto';
}

export function appliquerTheme(choix) {
  const racine = document.documentElement;
  if (choix === 'light' || choix === 'dark') racine.dataset.theme = choix;
  else delete racine.dataset.theme;

  try {
    if (choix === 'auto') localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, choix);
  } catch { /* stockage refuse : le choix vaut pour la session */ }

  majCouleurBarre();
}

/* La barre systeme du telephone doit suivre le fond de
   l'application, sinon l'ecran a l'air coupe en deux. */
export function majCouleurBarre() {
  const balise = document.querySelector('meta[name="theme-color"]');
  if (!balise) return;
  const fond = getComputedStyle(document.documentElement)
    .getPropertyValue('--md-sys-color-surface').trim();
  if (fond) balise.setAttribute('content', fond);
}

export function restaurerTheme() {
  let choix = 'auto';
  try {
    choix = localStorage.getItem(CLE) || 'auto';
  } catch { /* stockage refuse */ }
  appliquerTheme(choix);

  /* Suivre le systeme quand aucun choix explicite n'est fait. */
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (themeCourant() === 'auto') majCouleurBarre();
    });
}
