/* ============================================================
   METIER — statuts, rappels deduits, totaux, formats
   ------------------------------------------------------------
   Le renversement par rapport au cahier tient ici : le couturier
   ne saisit qu'une date, celle promise a la cliente. Tout le
   reste — quand commencer, quand s'inquieter, ce qui est en
   retard — se deduit de cette date et de la cadence du vetement.
   Aucune alerte a programmer a la main.
   ============================================================ */

/* ---------- Statuts ----------
   Quatre, et rien de plus. Pas de sous-etape, pas de pourcentage :
   le couturier connait son metier, il a besoin de savoir ou en est
   chaque commande vis-a-vis de la livraison. */

export const STATUTS = {
  a_commencer: { cle: 'a_commencer', libelle: 'À commencer', icone: 'content_cut', suivant: 'en_confection' },
  en_confection: { cle: 'en_confection', libelle: 'En confection', icone: 'iron', suivant: 'prete' },
  prete: { cle: 'prete', libelle: 'Prête', icone: 'check_circle', suivant: 'livree' },
  livree: { cle: 'livree', libelle: 'Livrée', icone: 'inventory_2', suivant: null },
};

export const ORDRE_STATUTS = ['a_commencer', 'en_confection', 'prete', 'livree'];

/* ---------- Cadences ----------
   Un ourlet ne se previent pas cinq jours a l'avance, un costume
   trois pieces si. Le couturier choisit une fois, a la commande. */

export const CADENCES = {
  rapide: { cle: 'rapide', libelle: 'Rapide', exemple: 'ourlet, retouche', anticipation: 1 },
  normale: { cle: 'normale', libelle: 'Normale', exemple: 'robe, chemise', anticipation: 3 },
  longue: { cle: 'longue', libelle: 'Longue', exemple: 'costume, tenue de mariage', anticipation: 6 },
};

/* ---------- Dates ----------
   Tout se compare en jours calendaires locaux. Comparer des
   horodatages ferait basculer une livraison « aujourd'hui » en
   « en retard » a la seconde ou l'heure de saisie est depassee. */

export const aujourdhui = () => jour(new Date());

export function jour(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function versISO(date) {
  const d = jour(date);
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${String(d.getDate()).padStart(2, '0')}`;
}

export function depuisISO(iso) {
  if (!iso) return null;
  const [annee, mois, date] = iso.split('-').map(Number);
  return new Date(annee, mois - 1, date);
}

export const joursEntre = (depuis, jusqua) =>
  Math.round((jour(jusqua) - jour(depuis)) / 86400000);

export const joursRestants = (commande) =>
  commande.dateLivraison ? joursEntre(aujourdhui(), depuisISO(commande.dateLivraison)) : null;

/* ---------- Etat d'une commande ----------
   Une seule fonction decide de l'urgence, pour que « Aujourd'hui »,
   la liste des commandes et le resume du matin ne puissent pas se
   contredire. */

export function etat(commande) {
  const restants = joursRestants(commande);
  const livree = commande.statut === 'livree';
  const enRetard = !livree && restants !== null && restants < 0;
  const livraisonAujourdhui = !livree && restants === 0;
  const anticipation = CADENCES[commande.cadence]?.anticipation ?? CADENCES.normale.anticipation;
  const aCommencer = commande.statut === 'a_commencer' && restants !== null && restants <= anticipation;

  return {
    restants,
    enRetard,
    livraisonAujourdhui,
    aCommencer,
    reste: reste(commande),
    urgence: enRetard ? 'retard' : livraisonAujourdhui || aCommencer ? 'bientot' : 'calme',
  };
}

/* ---------- Argent ----------
   Le solde reste du au couturier tant qu'il n'a pas ete encaisse,
   meme apres livraison. C'est tout l'interet par rapport au cahier :
   personne ne fait l'addition a la main, donc personne ne reclame. */

export const reste = (commande) =>
  commande.soldeRegle ? 0 : Math.max(0, (commande.prixTotal || 0) - (commande.acompte || 0));

export const estSoldee = (commande) => reste(commande) === 0;

/* ---------- Le resume de la journee ----------
   L'ecran doit se lire en trois secondes : les commandes arrivent
   deja triees par urgence pour que le premier regard tombe sur ce
   qui brule. */

export function resumeDuJour(commandes) {
  const avecEtat = commandes.map((c) => ({ commande: c, etat: etat(c) }));

  /* Chaque commande tombe dans un bloc et un seul, par ordre
     d'urgence decroissant. Sans cette exclusivite, une robe promise
     pour aujourd'hui et pas encore commencee apparaitrait deux fois
     sur l'ecran, et le couturier compterait deux commandes la ou il
     n'y en a qu'une. */
  const bloc = (x) => {
    if (x.etat.enRetard) return 'retard';
    if (x.etat.livraisonAujourdhui) return 'livraisons';
    if (x.etat.aCommencer) return 'aCommencer';
    if (x.commande.statut === 'en_confection') return 'enConfection';
    if (x.commande.statut === 'prete') return 'pretes';
    return null;
  };

  const blocs = { retard: [], livraisons: [], aCommencer: [], enConfection: [], pretes: [] };
  for (const x of avecEtat) {
    const cible = bloc(x);
    if (cible) blocs[cible].push(x);
  }

  /* Le plus en retard d'abord, puis l'echeance la plus proche. */
  const parEcheance = (a, b) => a.etat.restants - b.etat.restants;
  blocs.retard.sort(parEcheance);
  blocs.aCommencer.sort(parEcheance);
  blocs.enConfection.sort(parEcheance);
  blocs.pretes.sort(parEcheance);
  blocs.livraisons.sort((a, b) =>
    (a.commande.heureLivraison || '~').localeCompare(b.commande.heureLivraison || '~'));

  const impayees = commandes.filter((c) => reste(c) > 0);

  return {
    ...blocs,
    aEncaisser: impayees.reduce((total, c) => total + reste(c), 0),
    nbImpayees: impayees.length,
    enCours: commandes.filter((c) => c.statut !== 'livree').length,
    calme: blocs.retard.length === 0 && blocs.aCommencer.length === 0 && blocs.livraisons.length === 0,
  };
}

/* Le texte que l'application pousse le matin. Une notification par
   jour maximum : une application qui vibre huit fois est desinstallee
   dans la semaine. */
export function texteResume(resume) {
  if (resume.retard.length) {
    const n = resume.retard.length;
    return n === 1
      ? `1 commande en retard${resume.livraisons.length ? `, ${resume.livraisons.length} à livrer` : ''}`
      : `${n} commandes en retard${resume.livraisons.length ? `, ${resume.livraisons.length} à livrer` : ''}`;
  }
  const morceaux = [];
  if (resume.livraisons.length) morceaux.push(`${resume.livraisons.length} à livrer`);
  if (resume.aCommencer.length) morceaux.push(`${resume.aCommencer.length} à commencer`);
  if (!morceaux.length) return null;
  return morceaux.join(', ');
}

/* ---------- Recherche ----------
   Un nom ou les quatre derniers chiffres d'un numero. Les accents
   sont neutralises : personne ne tape « Fatou Ndiaye » avec le bon
   accent sur un clavier de telephone. */

export const normaliser = (texte) =>
  (texte || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const chiffres = (texte) => (texte || '').replace(/\D/g, '');

export function correspond(client, requete) {
  const q = normaliser(requete);
  if (!q) return true;
  if (normaliser(client.nom).includes(q)) return true;
  const qChiffres = chiffres(requete);
  return qChiffres.length >= 2 && chiffres(client.telephone).includes(qChiffres);
}

/* ---------- Formats ----------
   Typographie francaise : espace insecable comme separateur de
   milliers, pour qu'un montant ne se coupe jamais en fin de ligne. */

const INSECABLE = '\u00a0';

export const montant = (valeur) =>
  `${Math.round(valeur || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, INSECABLE)}${INSECABLE}F`;

export const nombreSeul = (valeur) =>
  Math.round(valeur || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, INSECABLE);

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function dateLongue(iso) {
  const d = depuisISO(iso);
  if (!d) return '';
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}

/* Casse de phrase : « Mercredi 26 août », pas « Mercredi 26 Août ».
   text-transform: capitalize en CSS majusculerait aussi le mois. */
export const majusculeInitiale = (texte) =>
  texte ? texte[0].toUpperCase() + texte.slice(1) : texte;

export function dateCourte(iso) {
  const d = depuisISO(iso);
  if (!d) return '';
  return `${d.getDate()} ${MOIS[d.getMonth()].slice(0, 4)}${MOIS[d.getMonth()].length > 4 ? '.' : ''} ${d.getFullYear()}`;
}

export function moisAnnee(iso) {
  const d = depuisISO(iso);
  if (!d) return '';
  return `${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/* « dans 3 jours », « demain », « il y a 2 jours » : le couturier
   raisonne en delai, pas en date absolue. */
export function delai(iso) {
  const restants = joursEntre(aujourdhui(), depuisISO(iso));
  if (restants === 0) return 'aujourd’hui';
  if (restants === 1) return 'demain';
  if (restants > 1) return `dans ${restants} jours`;
  /* « hier » serait exact mais ne dirait pas le retard : dans une
     liste, c'est le retard qui doit sauter aux yeux. */
  if (restants === -1) return '1 jour de retard';
  return `${-restants} jours de retard`;
}

export function anciennete(horodatage) {
  if (!horodatage) return '';
  const jours = joursEntre(new Date(horodatage), aujourdhui());
  if (jours <= 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  if (jours < 30) return `il y a ${jours} jours`;
  const mois = Math.round(jours / 30);
  if (mois < 24) return `il y a ${mois} mois`;
  return `il y a ${Math.round(mois / 12)} ans`;
}

/* Une mesure de plus de six mois merite une reprise : c'est ce que
   le couturier verifie d'abord quand une cliente revient. */
export const mesuresAnciennes = (majLe) => !majLe || joursEntre(new Date(majLe), aujourdhui()) > 180;

/* ---------- Mesures ----------
   Six mesures de base, six de plus derriere une divulgation
   progressive. Afficher douze champs d'un coup ferait fuir. */

export const MESURES_BASE = [
  { cle: 'poitrine', libelle: 'Poitrine' },
  { cle: 'taille', libelle: 'Taille' },
  { cle: 'hanches', libelle: 'Hanches' },
  { cle: 'epaule', libelle: 'Épaule' },
  { cle: 'manche', libelle: 'Manche' },
  { cle: 'longueur', libelle: 'Longueur' },
];

export const MESURES_PLUS = [
  { cle: 'cou', libelle: 'Cou' },
  { cle: 'bras', libelle: 'Tour de bras' },
  { cle: 'poignet', libelle: 'Poignet' },
  { cle: 'ceinture', libelle: 'Ceinture' },
  { cle: 'cuisse', libelle: 'Cuisse' },
  { cle: 'entrejambe', libelle: 'Entrejambe' },
];

export const TOUTES_MESURES = [...MESURES_BASE, ...MESURES_PLUS];

export const mesuresRemplies = (valeurs) =>
  TOUTES_MESURES.filter((m) => valeurs && valeurs[m.cle] !== undefined && valeurs[m.cle] !== '');

export const CATEGORIES = [
  { cle: 'femme', libelle: 'Femme' },
  { cle: 'homme', libelle: 'Homme' },
  { cle: 'enfant', libelle: 'Enfant' },
];
