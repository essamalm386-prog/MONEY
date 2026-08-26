/* ============================================================
   ROUTEUR — navigation par fragment d'URL
   ------------------------------------------------------------
   Le fragment plutot que l'API History : l'application doit
   pouvoir s'ouvrir en double-clic depuis un dossier, sans
   serveur, et le bouton retour du telephone doit fonctionner.
   ============================================================ */

const routes = [];
let rendreCourant = null;
let ecran = null;
let surChangement = null;

/* Les caracteres speciaux d'un chemin sont neutralises avant de
   construire l'expression : sans cela, le « ? » d'une chaine de
   requete se lirait comme un quantificateur. */
const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function route(motif, vue) {
  const parametres = [];
  const expression = new RegExp(
    `^${echapper(motif).replace(/:([a-z]+)/gi, (_, nom) => {
      parametres.push(nom);
      return '([^/]+)';
    })}$`,
  );
  routes.push({ expression, parametres, vue, motif });
}

export const chemin = () => window.location.hash.slice(1) || '/';

/* Le chemin sans sa chaine de requete : « /commandes?filtre=retard »
   resout la route « /commandes », le filtre arrive a la vue par un
   second argument. */
export const cheminSeul = () => chemin().split('?')[0] || '/';
export const recherche = () => new URLSearchParams(chemin().split('?')[1] || '');

export const aller = (destination, { remplacer = false } = {}) => {
  if (remplacer) window.location.replace(`#${destination}`);
  else window.location.hash = destination;
};

export const retour = () => (window.history.length > 1 ? window.history.back() : aller('/'));

export function demarrer(element, { surRoute } = {}) {
  ecran = element;
  surChangement = surRoute;
  window.addEventListener('hashchange', rendre);
  return rendre();
}

/* Re-rend l'ecran courant avec les memes parametres. Appele apres
   une ecriture pour que la liste reflete le changement sans que la
   vue ait a savoir comment elle a ete atteinte. */
export const rafraichir = () => (rendreCourant ? rendreCourant() : rendre());

async function rendre() {
  const actuel = cheminSeul();
  const trouvee = routes.map((r) => ({ r, m: actuel.match(r.expression) })).find((x) => x.m);

  if (!trouvee) {
    aller('/', { remplacer: true });
    return;
  }

  const arguments_ = Object.fromEntries(
    trouvee.r.parametres.map((nom, index) => [nom, decodeURIComponent(trouvee.m[index + 1])]),
  );

  rendreCourant = async () => {
    const contenu = await trouvee.r.vue(arguments_, recherche());
    /* Le rendu remplace l'ecran d'un coup : pas de mise a jour
       partielle, donc pas d'etat d'interface a resynchroniser. */
    ecran.replaceChildren(contenu);
    surChangement?.(trouvee.r.motif, arguments_);
  };

  await rendreCourant();
  /* Une nouvelle route repart du haut de son conteneur. */
  (ecran.closest('.ecran') || ecran).scrollTo(0, 0);
}
