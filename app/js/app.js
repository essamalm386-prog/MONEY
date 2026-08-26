/* ============================================================
   DRESS CODE By Essama
   Le cahier du couturier, qui se souvient a sa place.
   ------------------------------------------------------------
   Ce fichier assemble : theme, routes, barre du haut,
   navigation du bas, bouton de commande, service worker.
   Chaque ecran vit dans app/js/vues/.
   ============================================================ */

import { icone, message } from './interface.js';
import { aller, demarrer, retour, route } from './routeur.js';
import { restaurerTheme } from './theme.js';
import { resumeDuMatin } from './rappels.js';
import { lireAtelier } from './donnees.js';

import { vueAujourdhui } from './vues/aujourdhui.js';
import { vueCommandes } from './vues/commandes.js';
import { vueCommande } from './vues/commande.js';
import { vueNouvelleCommande } from './vues/nouvelle-commande.js';
import { vueClients } from './vues/clients.js';
import { vueClient } from './vues/client.js';
import { vueModeles } from './vues/modeles.js';
import { vueAtelier } from './vues/atelier.js';

/* ---------- Navigation ----------
   Quatre sections. Le catalogue et les clientes sont a portee de
   pouce ; tout le reste s'atteint depuis ces quatre ecrans. */

const SECTIONS = [
  { chemin: '/', libelle: 'Aujourd’hui', icone: 'today' },
  { chemin: '/commandes', libelle: 'Commandes', icone: 'checkroom' },
  { chemin: '/clients', libelle: 'Clientes', icone: 'group' },
  { chemin: '/modeles', libelle: 'Modèles', icone: 'photo_library' },
];

/* Titre et actions de la barre du haut, par route. Les ecrans de
   detail montrent une fleche de retour ; les sections principales
   montrent l'acces a l'atelier. */
const BARRES = {
  '/': { titre: 'DRESS CODE', marque: true },
  '/commandes': { titre: 'Commandes' },
  '/clients': { titre: 'Clientes' },
  '/modeles': { titre: 'Modèles' },
  '/atelier': { titre: 'Atelier', retour: true },
  '/commande/nouvelle': { titre: 'Nouvelle commande', retour: true },
  '/commande/:id': { titre: 'Commande', retour: true },
  '/client/:id': { titre: 'Cliente', retour: true },
};

/* Le bouton flottant porte l'action principale de l'ecran ou il
   apparait. Sur le catalogue, ajouter une commande n'aurait aucun
   sens : c'est un modele qu'on ajoute. */
const BOUTON = {
  '/': { libelle: 'Commande', action: () => aller('/commande/nouvelle') },
  '/commandes': { libelle: 'Commande', action: () => aller('/commande/nouvelle') },
  '/clients': { libelle: 'Commande', action: () => aller('/commande/nouvelle') },
  '/modeles': { libelle: 'Modèle', action: () => actionEcran() },
};

/* Les vues qui ont une action propre ecoutent cet evenement sur
   leur element racine. Il disparait avec elle au changement de
   route : aucun ecouteur ne survit a l'ecran qui l'a pose. */
function actionEcran() {
  colonne.firstElementChild?.dispatchEvent(new CustomEvent('action-principale'));
}

/* La creation d'une commande masque la navigation : c'est une tache
   en cours, pas un ecran a quitter. Un appui de travers sur un
   onglet perdrait le brouillon, et la fleche de retour suffit. */
const SANS_NAVIGATION = new Set(['/commande/nouvelle']);

const barre = document.getElementById('barre');
const navigation = document.getElementById('navigation');
const fab = document.getElementById('fab');
const colonne = document.getElementById('colonne');

route('/', vueAujourdhui);
route('/commandes', vueCommandes);
route('/clients', vueClients);
route('/modeles', vueModeles);
route('/atelier', vueAtelier);
route('/commande/nouvelle', (_, recherche) =>
  vueNouvelleCommande({ clientId: recherche.get('client') || null }));
route('/commande/:id', vueCommande);
route('/client/:id', vueClient);

function dessinerBarre(motif) {
  const forme = BARRES[motif] || { titre: 'DRESS CODE' };
  barre.innerHTML = `
    ${forme.retour
      ? `<button class="md-icon-btn" data-retour aria-label="Retour">${icone('arrow_back')}</button>`
      : ''}
    <h1 class="md-appbar-title${forme.marque ? ' titre-marque' : ''}">${forme.titre}</h1>
    ${forme.retour
      ? ''
      : `<button class="md-icon-btn" data-atelier aria-label="Atelier">${icone('storefront')}</button>`}`;

  barre.querySelector('[data-retour]')?.addEventListener('click', retour);
  barre.querySelector('[data-atelier]')?.addEventListener('click', () => aller('/atelier'));
}

function dessinerNavigation(motif) {
  navigation.innerHTML = SECTIONS.map((section) => {
    const actif = section.chemin === motif;
    return `
      <button class="md-navbar-item${actif ? ' active' : ''}" data-vers="${section.chemin}"
              aria-current="${actif ? 'page' : 'false'}">
        <span class="md-navbar-item-indicator">${icone(section.icone, { taille: 24 })}</span>
        <span>${section.libelle}</span>
      </button>`;
  }).join('');
}

navigation.addEventListener('click', (evenement) => {
  const bouton = evenement.target.closest('[data-vers]');
  if (bouton) aller(bouton.dataset.vers);
});

let actionBouton = null;
fab.addEventListener('click', () => actionBouton?.());

/* ---------- Reseau ----------
   L'application fonctionne hors ligne : on ne montre le bandeau
   que pour lever le doute, pas pour signaler une panne. */

function surveillerReseau() {
  const majuscule = () => {
    let bandeau = document.getElementById('hors-ligne');
    if (navigator.onLine) {
      bandeau?.remove();
      return;
    }
    if (bandeau) return;
    bandeau = document.createElement('p');
    bandeau.id = 'hors-ligne';
    bandeau.className = 'bandeau-hors-ligne';
    bandeau.innerHTML = `${icone('cloud_off', { taille: 20 })} Hors ligne — tout reste enregistré`;
    barre.after(bandeau);
  };
  window.addEventListener('online', majuscule);
  window.addEventListener('offline', majuscule);
  majuscule();
}

/* ---------- Demarrage ---------- */

async function demarrerApplication() {
  restaurerTheme();

  /* Le choix de theme enregistre dans l'atelier prime sur celui du
     stockage local : c'est lui qui suit la sauvegarde. */
  const atelier = await lireAtelier();
  if (atelier.themeChoisi) document.documentElement.dataset.theme = atelier.themeChoisi;

  surveillerReseau();

  await demarrer(colonne, {
    surRoute: (motif) => {
      dessinerBarre(motif);
      dessinerNavigation(motif);
      navigation.hidden = SANS_NAVIGATION.has(motif);
      /* Chaque vue redeclare son etat si elle en a un. */
      delete document.body.dataset.actionEnCours;
      const bouton = BOUTON[motif];
      fab.hidden = !bouton;
      if (bouton) {
        actionBouton = bouton.action;
        fab.querySelector('.fab-libelle').textContent = bouton.libelle;
      }
    },
  });

  /* Le resume du matin apres le premier rendu : l'ecran doit
     s'afficher sans attendre une permission de notification. */
  resumeDuMatin().catch(() => {});

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* Ouverture depuis un dossier local : l'application marche,
         sans la mise en cache. */
    });
  }
}

demarrerApplication().catch((erreur) => {
  console.error(erreur);
  message('L’application n’a pas pu démarrer', { erreur: true });
});
