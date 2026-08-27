/* ============================================================
   NOUVELLE COMMANDE — l'ecran qui decide de l'adoption
   ------------------------------------------------------------
   Le concurrent n'est pas une autre application, c'est un stylo :
   noter une commande au cahier prend quinze secondes. L'objectif
   ici est une minute, cliente devant soi, sans jamais quitter
   l'ecran.

   D'ou trois partis pris :
   — Un seul ecran qui defile. Pas d'assistant en cinq pages, pas
     de validation intermediaire : rien ne bloque le passage a
     l'etape suivante, on peut remplir dans le desordre.
   — Ce qui est connu est deja rempli. Les mesures d'une cliente
     existante, le prix du modele du catalogue, la date du jour.
   — Les saisies frequentes sont des appuis, pas des frappes :
     echeances en raccourcis, cadence en trois choix, pave
     numerique pour les montants.
   ============================================================ */

import { ajouterPhoto, ecrire, lireAtelier, lireTout, nouvelId, urlPhoto } from '../donnees.js';
import {
  CADENCES, MESURES_BASE, MESURES_PLUS, aujourdhui, correspond, dateLongue,
  majusculeInitiale, montant, versISO,
} from '../metier.js';
import { champNombre, etatVide, feuille, icone, message, nombre, txt, vignette } from '../interface.js';
import { capturer } from '../photo.js';
import { aller } from '../routeur.js';

const JOURS_COURTS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export async function vueNouvelleCommande({ clientId } = {}) {
  const [clients, modeles, atelier] = await Promise.all([
    lireTout('clients'),
    lireTout('modeles'),
    lireAtelier(),
  ]);

  /* Brouillon en memoire : la vue se redessine a chaque changement
     important, l'etat vit ici et non dans le DOM. */
  const brouillon = {
    client: clientId ? clients.find((c) => c.id === clientId) || null : null,
    nouveauClient: null,
    mesures: {},
    modele: null,
    modeleNom: '',
    photoId: null,
    photoUrl: null,
    prixTotal: 0,
    acompte: 0,
    cadence: atelier.cadenceParDefaut || 'normale',
    dateLivraison: '',
    mesuresEtendues: false,
  };

  if (brouillon.client) brouillon.mesures = { ...(brouillon.client.mesures || {}) };

  const section = document.createElement('form');
  section.className = 'pile';
  section.noValidate = true;

  const dessiner = async () => {
    section.innerHTML = await gabarit(brouillon, modeles);
    document.body.dataset.actionEnCours = 'oui';
    brancher();
  };

  /* --------------------------------------------------------
     Lecture des champs libres. Ils ne declenchent pas de rendu :
     re-dessiner a chaque frappe ferait perdre le focus et le
     curseur au milieu d'un prix.
     -------------------------------------------------------- */
  const collecter = () => {
    const lire = (nom) => section.querySelector(`[name="${nom}"]`);
    brouillon.modeleNom = lire('modeleNom')?.value.trim() || brouillon.modeleNom;
    brouillon.prixTotal = nombre(lire('prixTotal')?.value);
    brouillon.acompte = nombre(lire('acompte')?.value);
    for (const mesure of [...MESURES_BASE, ...MESURES_PLUS]) {
      const champ = lire(`mesure_${mesure.cle}`);
      if (champ) brouillon.mesures[mesure.cle] = champ.value.trim();
    }
    const nouveau = lire('nouveauNom');
    if (nouveau) {
      brouillon.nouveauClient = {
        nom: nouveau.value.trim(),
        telephone: lire('nouveauTelephone')?.value.trim() || '',
      };
    }
  };

  const majReste = () => {
    const reste = Math.max(0, nombre(section.querySelector('[name="prixTotal"]')?.value)
      - nombre(section.querySelector('[name="acompte"]')?.value));
    const zone = section.querySelector('[data-reste]');
    if (zone) zone.textContent = montant(reste);
  };

  function brancher() {
    section.querySelector('[data-choisir-client]')?.addEventListener('click', () => {
      collecter();
      ouvrirClients(clients, brouillon, dessiner);
    });

    section.querySelector('[data-changer-client]')?.addEventListener('click', () => {
      brouillon.client = null;
      brouillon.nouveauClient = null;
      brouillon.mesures = {};
      dessiner();
    });

    section.querySelector('[data-choisir-modele]')?.addEventListener('click', () => {
      collecter();
      ouvrirModeles(modeles, brouillon, dessiner);
    });

    for (const bouton of section.querySelectorAll('[data-photo]')) {
      bouton.addEventListener('click', async () => {
        collecter();
        const id = await capturer(ajouterPhoto, { camera: bouton.dataset.photo === 'camera' });
        if (!id) return;
        brouillon.photoId = id;
        brouillon.photoUrl = await urlPhoto(id);
        dessiner();
      });
    }

    section.querySelector('[data-plus-mesures]')?.addEventListener('click', () => {
      collecter();
      brouillon.mesuresEtendues = true;
      dessiner();
    });

    for (const bouton of section.querySelectorAll('[data-cadence]')) {
      bouton.addEventListener('click', () => {
        collecter();
        brouillon.cadence = bouton.dataset.cadence;
        dessiner();
      });
    }

    for (const bouton of section.querySelectorAll('[data-echeance]')) {
      bouton.addEventListener('click', () => {
        collecter();
        brouillon.dateLivraison = bouton.dataset.echeance;
        dessiner();
      });
    }

    section.querySelector('[name="dateLivraison"]')?.addEventListener('change', (evenement) => {
      collecter();
      brouillon.dateLivraison = evenement.target.value;
      dessiner();
    });

    section.querySelector('[name="prixTotal"]')?.addEventListener('input', majReste);
    section.querySelector('[name="acompte"]')?.addEventListener('input', majReste);

    section.querySelector('[data-enregistrer]')?.addEventListener('click', async () => {
      collecter();
      await enregistrer(brouillon, clients);
    });
  }

  await dessiner();
  return section;
}

/* ---------- Gabarit ---------- */

async function gabarit(brouillon, modeles) {
  const client = brouillon.client;
  const nomClient = client?.nom || brouillon.nouveauClient?.nom || '';
  const clientPret = Boolean(nomClient);
  const modelePret = Boolean(brouillon.modeleNom);
  const datePrete = Boolean(brouillon.dateLivraison);
  const reste = Math.max(0, brouillon.prixTotal - brouillon.acompte);

  return `
    ${etape(1, 'Cliente', clientPret, blocClient(brouillon))}
    ${etape(2, 'Mesures', Object.values(brouillon.mesures).some(Boolean), blocMesures(brouillon))}
    ${etape(3, 'Modèle', modelePret, blocModele(brouillon, modeles))}
    ${etape(4, 'Livraison', datePrete, blocLivraison(brouillon))}
    ${etape(5, 'Prix', brouillon.prixTotal > 0, blocPrix(brouillon))}

    <div class="barre-action">
      <div class="barre-action-total">
        <span class="md-label-medium">Reste à payer</span>
        <strong data-reste>${txt(montant(reste))}</strong>
      </div>
      <button type="button" class="md-btn md-btn-filled md-btn-lg" data-enregistrer>
        ${icone('check')} Enregistrer
      </button>
    </div>`;
}

const etape = (numero, titre, remplie, contenu) => `
  <section class="etape" data-remplie="${remplie ? 'oui' : 'non'}">
    <header class="etape-entete">
      <span class="etape-numero" aria-hidden="true">${remplie ? '✓' : numero}</span>
      <h2 class="etape-titre">${txt(titre)}</h2>
    </header>
    ${contenu}
  </section>`;

/* ---------- 1. Cliente ---------- */

function blocClient(brouillon) {
  const client = brouillon.client;
  if (client) {
    return `
      <div class="rangee-entre">
        <div class="carte-corps">
          <div class="carte-titre">${txt(client.nom)}</div>
          <div class="carte-detail">${txt(client.telephone || 'Numéro non renseigné')}</div>
        </div>
        <button type="button" class="md-btn md-btn-text" data-changer-client>Changer</button>
      </div>`;
  }

  /* Une cliente nouvelle, c'est deux champs et rien d'autre. Tout
     ce qu'on demanderait en plus serait tape devant elle. */
  return `
    <button type="button" class="md-btn md-btn-tonal md-btn-block" data-choisir-client>
      ${icone('search')} Chercher une cliente
    </button>
    <p class="md-help separateur-ou">ou nouvelle cliente</p>
    <div class="grille-deux">
      <div class="md-field">
        <label class="md-label" for="nouveauNom">Nom</label>
        <input id="nouveauNom" name="nouveauNom" class="md-input" autocomplete="name"
               value="${txt(brouillon.nouveauClient?.nom || '')}">
      </div>
      <div class="md-field">
        <label class="md-label" for="nouveauTelephone">Téléphone</label>
        <input id="nouveauTelephone" name="nouveauTelephone" class="md-input" type="tel"
               inputmode="tel" autocomplete="tel" value="${txt(brouillon.nouveauClient?.telephone || '')}">
      </div>
    </div>`;
}

/* ---------- 2. Mesures ---------- */

function blocMesures(brouillon) {
  const liste = brouillon.mesuresEtendues ? [...MESURES_BASE, ...MESURES_PLUS] : MESURES_BASE;
  const reprises = brouillon.client && Object.values(brouillon.client.mesures || {}).some(Boolean);

  return `
    ${reprises ? '<p class="md-help espace-apres">Reprises de la fiche, modifiables.</p>' : ''}
    <div class="mesures-saisie grille-deux">
      ${liste.map((mesure) => `
        <div class="md-field">
          <label class="md-label" for="mesure_${mesure.cle}">${txt(mesure.libelle)}</label>
          <div class="champ-suffixe">
            <input id="mesure_${mesure.cle}" name="mesure_${mesure.cle}" class="md-input"
                   type="text" inputmode="decimal" autocomplete="off"
                   value="${txt(brouillon.mesures[mesure.cle] || '')}">
            <span class="suffixe" aria-hidden="true">cm</span>
          </div>
        </div>`).join('')}
    </div>
    ${brouillon.mesuresEtendues ? '' : `
      <button type="button" class="md-btn md-btn-text" data-plus-mesures>
        ${icone('add')} Plus de mesures
      </button>`}`;
}

/* ---------- 3. Modele ---------- */

function blocModele(brouillon, modeles) {
  return `
    ${brouillon.photoUrl ? vignette(brouillon.photoUrl, { classe: 'vignette-large', alt: 'Modèle commandé' }) : ''}
    <div class="md-field${brouillon.photoUrl ? ' espace-avant' : ''}">
      <label class="md-label" for="modeleNom">Nom du modèle</label>
      <input id="modeleNom" name="modeleNom" class="md-input" autocomplete="off"
             value="${txt(brouillon.modeleNom)}">
    </div>
    <div class="rangee rangee-souple">
      ${modeles.length ? `<button type="button" class="md-btn md-btn-tonal" data-choisir-modele>
        ${icone('photo_library')} Catalogue
      </button>` : ''}
      <button type="button" class="md-btn md-btn-outlined" data-photo="camera">
        ${icone('photo_camera')} Photo
      </button>
      <button type="button" class="md-btn md-btn-outlined" data-photo="galerie">
        ${icone('image')} Galerie
      </button>
    </div>`;
}

/* ---------- 4. Livraison ----------
   Une seule date a saisir. Les raccourcis couvrent la majorite des
   cas — « vendredi », « dans une semaine » — et le calendrier reste
   la pour le reste. */

function blocLivraison(brouillon) {
  const propositions = echeances();
  return `
    <div class="raccourcis">
      ${propositions.map((p) => `
        <button type="button" class="md-chip md-chip-assist ${brouillon.dateLivraison === p.iso ? 'md-chip-selected' : ''}"
                data-echeance="${p.iso}">${txt(p.libelle)}</button>`).join('')}
    </div>
    <div class="md-field">
      <label class="md-label" for="dateLivraison">Date de livraison</label>
      <input id="dateLivraison" name="dateLivraison" class="md-input" type="date"
             min="${versISO(aujourdhui())}" value="${txt(brouillon.dateLivraison)}">
    </div>
    ${brouillon.dateLivraison ? `<p class="md-help">${txt(dateLongue(brouillon.dateLivraison))}</p>` : ''}

    <p class="md-label espace-avant-large">Temps de confection</p>
    <p class="md-help espace-apres-court">Décide du moment où l’application prévient de commencer.</p>
    <div class="raccourcis">
      ${Object.values(CADENCES).map((cadence) => `
        <button type="button" class="md-chip md-chip-filter ${brouillon.cadence === cadence.cle ? 'md-chip-selected' : ''}"
                data-cadence="${cadence.cle}" aria-pressed="${brouillon.cadence === cadence.cle}">
          ${txt(cadence.libelle)}
        </button>`).join('')}
    </div>
    <p class="md-help">${txt(CADENCES[brouillon.cadence]?.exemple || '')}</p>`;
}

/* Les echeances proposees : demain, apres-demain, puis les deux
   fins de semaine a venir. Ce sont les dates qu'un couturier
   annonce a l'oral. */
function echeances() {
  const base = aujourdhui();
  const dans = (jours) => {
    const d = new Date(base);
    d.setDate(d.getDate() + jours);
    return d;
  };
  const propositions = [
    { libelle: 'Demain', date: dans(1) },
    { libelle: 'Dans 3 jours', date: dans(3) },
  ];

  const vendredi = dans((5 - base.getDay() + 7) % 7 || 7);
  propositions.push({ libelle: majusculeInitiale(JOURS_COURTS[5]), date: vendredi });
  propositions.push({ libelle: 'Dans 1 semaine', date: dans(7) });
  propositions.push({ libelle: 'Dans 2 semaines', date: dans(14) });

  const vues = new Set();
  return propositions
    .map((p) => ({ libelle: p.libelle, iso: versISO(p.date) }))
    .filter((p) => (vues.has(p.iso) ? false : vues.add(p.iso)));
}

/* ---------- 5. Prix ---------- */

const blocPrix = (brouillon) => `
  <div class="grille-deux">
    ${champNombre({ id: 'prixTotal', libelle: 'Prix total', valeur: brouillon.prixTotal || '', suffixe: 'F' })}
    ${champNombre({ id: 'acompte', libelle: 'Avance versée', valeur: brouillon.acompte || '', suffixe: 'F' })}
  </div>`;

/* ---------- Choix de la cliente ----------
   Trois lettres suffisent. Le filtre tourne en memoire : sur un
   carnet de quelques centaines de clientes, aucun index ne va
   plus vite qu'un parcours de tableau, et le resultat apparait
   a la frappe. */

function ouvrirClients(clients, brouillon, dessiner) {
  const panneau = feuille({
    titre: 'Chercher une cliente',
    contenu: `
      <div class="recherche">
        ${icone('search')}
        <input class="md-input" type="search" id="recherche-cliente"
               inputmode="search" autocomplete="off" enterkeyhint="search"
               aria-label="Nom ou quatre derniers chiffres">
      </div>
      <div data-resultats></div>`,
    surOuverture: (dialogue) => dialogue.querySelector('#recherche-cliente').focus(),
  });

  const champ = panneau.querySelector('#recherche-cliente');
  const zone = panneau.querySelector('[data-resultats]');

  const afficher = () => {
    const trouves = clients.filter((c) => correspond(c, champ.value)).slice(0, 40);
    zone.innerHTML = trouves.length
      ? trouves.map((c) => `
          <button type="button" class="carte-lien" data-client="${txt(c.id)}">
            <span class="carte-corps">
              <span class="carte-titre">${txt(c.nom)}</span>
              <span class="carte-detail">${txt(c.telephone || 'Numéro non renseigné')}</span>
            </span>
            ${icone('chevron_right')}
          </button>`).join('')
      : etatVide({ icone: 'group', titre: 'Aucune cliente à ce nom.' });
  };

  champ.addEventListener('input', afficher);
  zone.addEventListener('click', (evenement) => {
    const bouton = evenement.target.closest('[data-client]');
    if (!bouton) return;
    brouillon.client = clients.find((c) => c.id === bouton.dataset.client) || null;
    brouillon.nouveauClient = null;
    brouillon.mesures = { ...(brouillon.client?.mesures || {}) };
    panneau.close();
    dessiner();
  });
  afficher();
}

/* ---------- Choix du modele ----------
   Le prix du catalogue se recopie comme point de depart et reste
   modifiable : le tarif reel depend du tissu et des finitions. */

function ouvrirModeles(modeles, brouillon, dessiner) {
  const panneau = feuille({
    titre: 'Catalogue',
    contenu: `<div class="grille-modeles" data-grille></div>`,
  });
  const grille = panneau.querySelector('[data-grille]');

  Promise.all(modeles.map(async (m) => ({ modele: m, url: await urlPhoto(m.photoId) }))).then((entrees) => {
    grille.innerHTML = entrees.map(({ modele, url }) => `
      <button type="button" class="carte-modele" data-modele="${txt(modele.id)}">
        ${vignette(url, { alt: modele.nom })}
        <span class="carte-modele-nom">${txt(modele.nom)}</span>
        ${modele.prixIndicatif
          ? `<span class="carte-modele-prix">à partir de ${txt(montant(modele.prixIndicatif))}</span>`
          : ''}
      </button>`).join('');
  });

  grille.addEventListener('click', async (evenement) => {
    const bouton = evenement.target.closest('[data-modele]');
    if (!bouton) return;
    const modele = modeles.find((m) => m.id === bouton.dataset.modele);
    if (!modele) return;
    brouillon.modele = modele;
    brouillon.modeleNom = modele.nom;
    brouillon.photoId = modele.photoId;
    brouillon.photoUrl = await urlPhoto(modele.photoId);
    if (modele.prixIndicatif && !brouillon.prixTotal) brouillon.prixTotal = modele.prixIndicatif;
    panneau.close();
    dessiner();
  });
}

/* ---------- Enregistrement ----------
   Deux informations sont indispensables : qui, et pour quand.
   Tout le reste peut se completer plus tard depuis la fiche —
   bloquer sur un prix manquant ferait perdre la commande. */

async function enregistrer(brouillon, clients) {
  const nomSaisi = brouillon.nouveauClient?.nom?.trim();
  if (!brouillon.client && !nomSaisi) {
    message('Nom de la cliente manquant', { erreur: true });
    document.querySelector('[name="nouveauNom"]')?.focus();
    return;
  }
  if (!brouillon.dateLivraison) {
    message('Date de livraison manquante', { erreur: true });
    document.querySelector('[name="dateLivraison"]')?.focus();
    return;
  }

  const mesures = Object.fromEntries(
    Object.entries(brouillon.mesures).filter(([, valeur]) => valeur !== '' && valeur !== undefined),
  );

  let client = brouillon.client;
  if (!client) {
    /* Un meme numero note deux fois, c'est deux fiches et un
       historique coupe en deux. On rattache au lieu de dupliquer. */
    const telephone = brouillon.nouveauClient.telephone.replace(/\D/g, '');
    const existant = telephone
      ? clients.find((c) => (c.telephone || '').replace(/\D/g, '') === telephone)
      : null;
    client = existant || {
      id: nouvelId('cli'),
      nom: nomSaisi,
      telephone: brouillon.nouveauClient.telephone,
      creeLe: Date.now(),
    };
  }

  const aDesMesures = Object.keys(mesures).length > 0;
  await ecrire('clients', {
    ...client,
    mesures: aDesMesures ? mesures : client.mesures || {},
    mesuresMajLe: aDesMesures ? Date.now() : client.mesuresMajLe || null,
    majLe: Date.now(),
  });

  const commande = {
    id: nouvelId('cmd'),
    clientId: client.id,
    modeleId: brouillon.modele?.id || null,
    modeleNom: brouillon.modeleNom || 'Commande',
    photoId: brouillon.photoId,
    mesures,
    cadence: brouillon.cadence,
    statut: 'a_commencer',
    dateCommande: versISO(aujourdhui()),
    dateLivraison: brouillon.dateLivraison,
    prixTotal: brouillon.prixTotal,
    acompte: brouillon.acompte,
    soldeRegle: brouillon.prixTotal > 0 && brouillon.acompte >= brouillon.prixTotal,
    recapEnvoyeLe: null,
    creeLe: Date.now(),
    majLe: Date.now(),
  };

  await ecrire('commandes', commande);
  message('Commande enregistrée');
  /* On atterrit sur la fiche : le geste suivant, c'est l'envoi du
     recapitulatif a la cliente, tant qu'elle est encore la. */
  aller(`/commande/${commande.id}`, { remplacer: true });
}
