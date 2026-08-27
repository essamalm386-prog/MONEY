/* ============================================================
   FICHE COMMANDE — ou l'on avance le travail
   ------------------------------------------------------------
   Deux gestes dominent : faire avancer le statut, et envoyer la
   fiche a la cliente. Ils sont donc les deux plus gros boutons.
   Le reste — mesures, argent, notes — se lit sans agir.
   ============================================================ */

import {
  ecrire, lire, lireAtelier, lireTout, nouvelId, supprimer, urlPhoto,
} from '../donnees.js';
import {
  ORDRE_STATUTS, STATUTS, anciennete, dateLongue, delai, etat, montant, reste,
} from '../metier.js';
import { confirmer, feuille, icone, message, txt, vibrer, vignette } from '../interface.js';
import { aller, rafraichir, retour } from '../routeur.js';
import { ouvrirRecap } from './recap-partage.js';

export async function vueCommande({ id }) {
  const commande = await lire('commandes', id);
  if (!commande) {
    retour();
    return document.createElement('div');
  }

  const [client, atelier, photoUrl] = await Promise.all([
    lire('clients', commande.clientId),
    lireAtelier(),
    urlPhoto(commande.photoId),
  ]);

  const situation = etat(commande);
  const du = reste(commande);
  const statut = STATUTS[commande.statut];
  const suivant = statut.suivant ? STATUTS[statut.suivant] : null;

  const section = document.createElement('div');
  section.className = 'pile-large';
  section.innerHTML = `
    <div class="pile">
      ${photoUrl ? vignette(photoUrl, { classe: 'vignette-large', alt: `Modèle : ${commande.modeleNom}` }) : ''}
      <div>
        <h1 class="md-headline-small">${txt(commande.modeleNom)}</h1>
        <p class="md-body-large md-muted">
          <a href="#/client/${txt(commande.clientId)}">${txt(client?.nom || 'Cliente supprimée')}</a>
        </p>
      </div>
      ${bandeauEcheance(commande, situation)}
    </div>

    <div>
      ${parcours(commande)}
      <div class="rangee rangee-souple">
        ${suivant
          ? `<button class="md-btn md-btn-filled md-btn-lg" data-avancer="${suivant.cle}">
               ${icone(suivant.icone)} ${txt(libelleAvancer(suivant.cle))}
             </button>`
          : ''}
        <button class="md-btn ${suivant ? 'md-btn-outlined' : 'md-btn-filled'}" data-recap>
          ${icone('send')} Envoyer la fiche
        </button>
      </div>
    </div>

    <section>
      <h2 class="md-title-medium titre-section">Argent</h2>
      <dl class="pile-serree">
        <div class="ligne-info"><dt>Montant total</dt><dd>${txt(montant(commande.prixTotal))}</dd></div>
        <div class="ligne-info"><dt>Avance versée</dt><dd>${txt(montant(commande.acompte))}</dd></div>
        <div class="ligne-info ligne-total">
          <dt>${commande.soldeRegle ? 'Soldé' : 'Reste à payer'}</dt>
          <dd>${txt(montant(du))}</dd>
        </div>
      </dl>
      ${du > 0
        ? `<button class="md-btn md-btn-tonal md-btn-block espace-avant" data-solder>
             ${icone('payments')} Marquer le solde réglé
           </button>`
        : ''}
    </section>

    ${blocMesures(commande)}

    <section>
      <h2 class="md-title-medium titre-section">Détail</h2>
      <dl class="pile-serree">
        <div class="ligne-info"><dt>Commandé le</dt><dd>${txt(dateLongue(commande.dateCommande))}</dd></div>
        <div class="ligne-info"><dt>Livraison</dt><dd>${txt(dateLongue(commande.dateLivraison))}</dd></div>
        <div class="ligne-info"><dt>Temps de confection</dt><dd>${txt(libelleCadence(commande.cadence))}</dd></div>
        ${commande.recapEnvoyeLe
          ? `<div class="ligne-info"><dt>Fiche envoyée</dt><dd>${txt(anciennete(commande.recapEnvoyeLe))}</dd></div>`
          : ''}
      </dl>
    </section>

    <div class="rangee rangee-souple">
      <button class="md-btn md-btn-text" data-modifier>${icone('edit')} Modifier</button>
      <button class="md-btn md-btn-text" data-supprimer>${icone('delete')} Supprimer</button>
    </div>`;

  /* ---------- Actions ---------- */

  section.querySelector('[data-avancer]')?.addEventListener('click', async (evenement) => {
    const vise = evenement.currentTarget.dataset.avancer;
    vibrer();
    await avancer(commande, vise, { client, atelier, photoUrl });
  });

  section.querySelector('[data-recap]')?.addEventListener('click', () => {
    ouvrirRecap({ commande, client, atelier, photoUrl });
  });

  section.querySelector('[data-solder]')?.addEventListener('click', async () => {
    await ecrire('commandes', { ...commande, soldeRegle: true, majLe: Date.now() });
    message('Solde réglé');
    rafraichir();
  });

  section.querySelector('[data-modifier]')?.addEventListener('click', () => {
    ouvrirModification(commande);
  });

  section.querySelector('[data-supprimer]')?.addEventListener('click', async () => {
    const confirme = await confirmer({
      titre: 'Supprimer cette commande ?',
      corps: `${commande.modeleNom} — ${client?.nom || ''}. La fiche et son historique disparaissent.`,
      action: 'Supprimer',
      danger: true,
    });
    if (!confirme) return;
    await supprimer('commandes', commande.id);
    message('Commande supprimée');
    aller('/commandes');
  });

  return section;
}

/* ---------- Avancement du statut ----------
   Passer a « Prete » propose de prevenir la cliente : c'est le
   moment ou l'atelier se desencombre. Passer a « Livree » demande
   si le solde a ete regle, sinon la commande reste comptee dans
   ce qui reste a encaisser. */

async function avancer(commande, vise, contexte) {
  if (vise === 'livree' && reste(commande) > 0) {
    const regle = await confirmer({
      titre: 'Le solde a-t-il été réglé ?',
      corps: `Reste ${montant(reste(commande))}. Sinon la commande reste comptée dans ce qui vous est dû.`,
      action: 'Oui, réglé',
    });
    commande = { ...commande, soldeRegle: regle };
  }

  const misAJour = {
    ...commande,
    statut: vise,
    majLe: Date.now(),
    livreeLe: vise === 'livree' ? Date.now() : commande.livreeLe || null,
  };
  await ecrire('commandes', misAJour);
  message(`${STATUTS[vise].libelle}`);

  if (vise === 'prete') {
    /* La feuille peut se fermer sans envoi : le statut a change
       quand meme, l'ecran derriere doit le montrer. */
    const panneau = ouvrirRecap({ ...contexte, commande: misAJour, variante: 'prete' });
    panneau.addEventListener('close', () => rafraichir(), { once: true });
    return;
  }
  if (vise === 'livree') {
    await proposerCatalogue(misAJour, contexte);
    return;
  }
  rafraichir();
}

/* Le catalogue se remplit tout seul : a chaque livraison, la photo
   et le prix existent deja. En deux mois d'usage normal, le
   couturier a trente modeles sans avoir jamais constitue de
   catalogue. */
async function proposerCatalogue(commande, contexte) {
  if (!commande.photoId || commande.modeleId) {
    rafraichir();
    return;
  }
  const modeles = await lireTout('modeles');
  if (modeles.some((m) => m.photoId === commande.photoId)) {
    rafraichir();
    return;
  }

  const ajouter = await confirmer({
    titre: 'Ajouter ce modèle au catalogue ?',
    corps: `${commande.modeleNom} restera visible pour le montrer à une cliente.`,
    action: 'Ajouter',
  });
  if (ajouter) {
    await ecrire('modeles', {
      id: nouvelId('mod'),
      nom: commande.modeleNom,
      categorie: '',
      prixIndicatif: commande.prixTotal || 0,
      photoId: commande.photoId,
      creeLe: Date.now(),
    });
    message('Ajouté au catalogue');
  }
  rafraichir();
}

/* ---------- Modification ----------
   Les seuls champs qu'on corrige apres coup : la date, les
   montants, le nom du modele. Le reste se refait par une nouvelle
   commande. */

function ouvrirModification(commande) {
  const panneau = feuille({
    titre: 'Modifier la commande',
    contenu: `
      <div class="md-field">
        <label class="md-label" for="edit-nom">Nom du modèle</label>
        <input id="edit-nom" class="md-input" value="${txt(commande.modeleNom)}">
      </div>
      <div class="md-field">
        <label class="md-label" for="edit-date">Date de livraison</label>
        <input id="edit-date" class="md-input" type="date" value="${txt(commande.dateLivraison)}">
      </div>
      <div class="grille-deux">
        <div class="md-field">
          <label class="md-label" for="edit-total">Prix total</label>
          <input id="edit-total" class="md-input" inputmode="numeric" value="${commande.prixTotal || ''}">
        </div>
        <div class="md-field">
          <label class="md-label" for="edit-acompte">Avance versée</label>
          <input id="edit-acompte" class="md-input" inputmode="numeric" value="${commande.acompte || ''}">
        </div>
      </div>
      <button class="md-btn md-btn-filled md-btn-block" data-valider>Enregistrer</button>`,
  });

  panneau.querySelector('[data-valider]').addEventListener('click', async () => {
    const valeur = (id) => panneau.querySelector(id).value;
    const nombre = (id) => Number(valeur(id).replace(/[^\d]/g, '')) || 0;
    await ecrire('commandes', {
      ...commande,
      modeleNom: valeur('#edit-nom').trim() || commande.modeleNom,
      dateLivraison: valeur('#edit-date') || commande.dateLivraison,
      prixTotal: nombre('#edit-total'),
      acompte: nombre('#edit-acompte'),
      majLe: Date.now(),
    });
    panneau.close();
    message('Commande modifiée');
    rafraichir();
  });
}

/* ---------- Morceaux de gabarit ---------- */

const libelleAvancer = (cle) =>
  ({ en_confection: 'Commencer', prete: 'Marquer prête', livree: 'Marquer livrée' })[cle] || 'Suivant';

const libelleCadence = (cle) =>
  ({ rapide: 'Rapide', normale: 'Normale', longue: 'Longue' })[cle] || 'Normale';

function bandeauEcheance(commande, situation) {
  if (commande.statut === 'livree') {
    return `<p class="md-alert md-alert-neutral">${icone('inventory_2')}
      <span>Livrée le ${txt(dateLongue(commande.dateLivraison))}</span></p>`;
  }
  if (situation.enRetard) {
    return `<p class="md-alert md-alert-error">${icone('priority_high')}
      <span><span class="md-alert-title">En retard de ${-situation.restants} jour${situation.restants < -1 ? 's' : ''}</span>
      Livraison promise ${txt(dateLongue(commande.dateLivraison))}</span></p>`;
  }
  return `<p class="md-alert">${icone('schedule')}
    <span><span class="md-alert-title">Livraison ${txt(delai(commande.dateLivraison))}</span>
    ${txt(dateLongue(commande.dateLivraison))}</span></p>`;
}

function parcours(commande) {
  const position = ORDRE_STATUTS.indexOf(commande.statut);
  return `
    <div class="parcours" role="img" aria-label="Statut : ${txt(STATUTS[commande.statut].libelle)}">
      ${ORDRE_STATUTS.map((cle, index) => `
        <span class="parcours-etape"
              data-atteinte="${index <= position ? 'oui' : 'non'}"
              data-courante="${index === position ? 'oui' : 'non'}">
          ${icone(STATUTS[cle].icone, { taille: 20, pleine: index <= position })}
          ${txt(STATUTS[cle].libelle)}
        </span>`).join('')}
    </div>`;
}

function blocMesures(commande) {
  const entrees = Object.entries(commande.mesures || {}).filter(([, valeur]) => valeur);
  if (!entrees.length) return '';
  const libelles = {
    poitrine: 'Poitrine', taille: 'Taille', hanches: 'Hanches', epaule: 'Épaule',
    manche: 'Manche', longueur: 'Longueur', cou: 'Cou', bras: 'Tour de bras',
    poignet: 'Poignet', ceinture: 'Ceinture', cuisse: 'Cuisse', entrejambe: 'Entrejambe',
  };
  return `
    <section>
      <h2 class="md-title-medium titre-section">Mesures de cette commande</h2>
      <div class="mesures">
        ${entrees.map(([cle, valeur]) => `
          <div class="mesure">
            <div class="mesure-libelle">${txt(libelles[cle] || cle)}</div>
            <div class="mesure-valeur">${txt(valeur)}</div>
          </div>`).join('')}
      </div>
    </section>`;
}
