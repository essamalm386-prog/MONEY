/* ============================================================
   FICHE CLIENTE
   ------------------------------------------------------------
   Trois choses comptent, dans cet ordre :
   — Les mesures d'abord, avec leur date. Le couturier voit tout
     de suite s'il doit remesurer ou non.
   — Les photos des anciens modeles. « Je vous refais le meme que
     l'an dernier ? » — et on le lui montre.
   — Une nouvelle commande qui part de la fiche : les mesures sont
     deja la, il ne reste que le modele, la date et le prix.
   ============================================================ */

import { ecrire, lire, lireParIndex, supprimer, urlPhoto } from '../donnees.js';
import {
  MESURES_BASE, TOUTES_MESURES, anciennete, delai, mesuresAnciennes,
  mesuresRemplies, moisAnnee, montant, reste,
} from '../metier.js';
import { confirmer, etatVide, feuille, icone, message, txt, vignette } from '../interface.js';
import { aller, rafraichir, retour } from '../routeur.js';

export async function vueClient({ id }) {
  const client = await lire('clients', id);
  if (!client) {
    retour();
    return document.createElement('div');
  }

  const [commandes, envois] = await Promise.all([
    lireParIndex('commandes', 'clientId', id),
    lireParIndex('envois', 'clientId', id),
  ]);

  const enCours = commandes.filter((c) => c.statut !== 'livree').sort(parEcheance);
  const passees = commandes.filter((c) => c.statut === 'livree').sort((a, b) => (b.livreeLe || 0) - (a.livreeLe || 0));
  const du = commandes.reduce((total, c) => total + reste(c), 0);
  const dernierEnvoi = envois.sort((a, b) => b.le - a.le)[0];

  const vignettes = new Map(
    await Promise.all(commandes.map(async (c) => [c.id, await urlPhoto(c.photoId)])),
  );

  const section = document.createElement('div');
  section.className = 'pile-large';
  section.innerHTML = `
    <header class="pile">
      <div class="rangee">
        <span class="pastille pastille-large" aria-hidden="true">${txt(initiales(client.nom))}</span>
        <div class="carte-corps">
          <h1 class="md-headline-small">${txt(client.nom)}</h1>
          <p class="md-body-medium md-muted">${txt(client.telephone || 'Numéro non renseigné')}</p>
        </div>
      </div>
      <div class="rangee rangee-souple">
        ${client.telephone
          ? `<a class="md-btn md-btn-tonal" href="tel:${txt(client.telephone.replace(/\s/g, ''))}">
               ${icone('call')} Appeler
             </a>`
          : ''}
        <button class="md-btn md-btn-filled" data-commander>${icone('add')} Nouvelle commande</button>
      </div>
      ${du > 0
        ? `<p class="md-alert md-alert-error">${icone('payments')}
             <span><span class="md-alert-title">${txt(montant(du))} à encaisser</span>
             sur ${commandes.filter((c) => reste(c) > 0).length} commande${
               commandes.filter((c) => reste(c) > 0).length > 1 ? 's' : ''}</span></p>`
        : ''}
    </header>

    ${blocMesures(client)}

    ${enCours.length ? `
      <section>
        <h2 class="md-title-medium titre-section">En cours</h2>
        ${enCours.map((c) => carteCommande(c, vignettes.get(c.id))).join('')}
      </section>` : ''}

    ${passees.length ? `
      <section>
        <h2 class="md-title-medium titre-section">Historique — ${passees.length} commande${passees.length > 1 ? 's' : ''}</h2>
        ${passees.map((c) => carteCommande(c, vignettes.get(c.id), true)).join('')}
      </section>` : ''}

    ${!commandes.length ? etatVide({
      icone: 'checkroom',
      titre: 'Aucune commande pour cette cliente.',
    }) : ''}

    ${dernierEnvoi
      ? `<p class="md-body-small md-muted">${txt(libelleEnvoi(dernierEnvoi))}</p>`
      : ''}

    <div class="rangee rangee-souple">
      <button class="md-btn md-btn-text" data-modifier>${icone('edit')} Modifier la fiche</button>
      <button class="md-btn md-btn-text" data-supprimer>${icone('delete')} Supprimer</button>
    </div>`;

  section.querySelector('[data-commander]').addEventListener('click', () =>
    aller(`/commande/nouvelle?client=${encodeURIComponent(client.id)}`));

  section.querySelector('[data-mesures]')?.addEventListener('click', () => ouvrirMesures(client));

  section.querySelector('[data-modifier]').addEventListener('click', () => ouvrirFiche(client));

  section.querySelector('[data-supprimer]').addEventListener('click', async () => {
    const confirme = await confirmer({
      titre: 'Supprimer cette cliente ?',
      corps: commandes.length
        ? `Ses ${commandes.length} commande${commandes.length > 1 ? 's' : ''} et ses mesures disparaissent.`
        : 'Ses mesures disparaissent.',
      action: 'Supprimer',
      danger: true,
    });
    if (!confirme) return;
    await Promise.all(commandes.map((c) => supprimer('commandes', c.id)));
    await supprimer('clients', client.id);
    message('Cliente supprimée');
    aller('/clients');
  });

  section.addEventListener('click', (evenement) => {
    const carte = evenement.target.closest('[data-commande]');
    if (carte) aller(`/commande/${carte.dataset.commande}`);
  });

  return section;
}

const parEcheance = (a, b) => (a.dateLivraison || '').localeCompare(b.dateLivraison || '');

/* ---------- Mesures ----------
   Elles apparaissent en premier, avec leur date. Deux mois ou
   deux ans, ce n'est pas la meme decision. */

function blocMesures(client) {
  const remplies = mesuresRemplies(client.mesures);
  const vieilles = mesuresAnciennes(client.mesuresMajLe);

  if (!remplies.length) {
    return `
      <section>
        <div class="rangee-entre espace-apres-court">
          <h2 class="md-title-medium">Mesures</h2>
          <button class="md-btn md-btn-text" data-mesures>${icone('straighten')} Prendre</button>
        </div>
        <p class="md-body-medium md-muted">Aucune mesure enregistrée.</p>
      </section>`;
  }

  return `
    <section>
      <div class="rangee-entre espace-apres-court">
        <h2 class="md-title-medium">Mesures</h2>
        <button class="md-btn md-btn-text" data-mesures>${icone('edit')} Modifier</button>
      </div>
      <p class="md-body-small ${vieilles ? 'texte-alerte' : 'md-muted'} espace-apres-court">
        ${vieilles ? icone('schedule', { taille: 20 }) : ''}
        Mises à jour ${txt(anciennete(client.mesuresMajLe))}${vieilles ? ' — à revérifier' : ''}
      </p>
      <div class="mesures">
        ${remplies.map((mesure) => `
          <div class="mesure">
            <div class="mesure-libelle">${txt(mesure.libelle)}</div>
            <div class="mesure-valeur">${txt(client.mesures[mesure.cle])}</div>
          </div>`).join('')}
      </div>
    </section>`;
}

function ouvrirMesures(client) {
  const valeurs = client.mesures || {};
  const panneau = feuille({
    titre: 'Mesures',
    contenu: `
      <div class="grille-deux">
        ${TOUTES_MESURES.map((mesure) => `
          <div class="md-field">
            <label class="md-label" for="m_${mesure.cle}">${txt(mesure.libelle)}</label>
            <div class="champ-suffixe">
              <input id="m_${mesure.cle}" class="md-input" type="text" inputmode="decimal"
                     autocomplete="off" value="${txt(valeurs[mesure.cle] || '')}">
              <span class="suffixe" aria-hidden="true">cm</span>
            </div>
          </div>`).join('')}
      </div>
      <button class="md-btn md-btn-filled md-btn-block" data-valider>Enregistrer</button>`,
    surOuverture: (dialogue) => dialogue.querySelector(`#m_${MESURES_BASE[0].cle}`)?.focus(),
  });

  panneau.querySelector('[data-valider]').addEventListener('click', async () => {
    const nouvelles = {};
    for (const mesure of TOUTES_MESURES) {
      const valeur = panneau.querySelector(`#m_${mesure.cle}`).value.trim();
      if (valeur) nouvelles[mesure.cle] = valeur;
    }
    await ecrire('clients', {
      ...client,
      mesures: nouvelles,
      mesuresMajLe: Date.now(),
      majLe: Date.now(),
    });
    panneau.close();
    message('Mesures enregistrées');
    rafraichir();
  });
}

/* ---------- Fiche ---------- */

function ouvrirFiche(client) {
  const panneau = feuille({
    titre: 'Fiche cliente',
    contenu: `
      <div class="md-field">
        <label class="md-label" for="f-nom">Nom</label>
        <input id="f-nom" class="md-input" autocomplete="name" value="${txt(client.nom)}">
      </div>
      <div class="md-field">
        <label class="md-label" for="f-tel">Téléphone</label>
        <input id="f-tel" class="md-input" type="tel" inputmode="tel" autocomplete="tel"
               value="${txt(client.telephone || '')}">
      </div>
      <button class="md-btn md-btn-filled md-btn-block" data-valider>Enregistrer</button>`,
  });

  panneau.querySelector('[data-valider]').addEventListener('click', async () => {
    const nom = panneau.querySelector('#f-nom').value.trim();
    if (!nom) {
      message('Nom obligatoire', { erreur: true });
      return;
    }
    await ecrire('clients', {
      ...client,
      nom,
      telephone: panneau.querySelector('#f-tel').value.trim(),
      majLe: Date.now(),
    });
    panneau.close();
    message('Fiche modifiée');
    rafraichir();
  });
}

/* ---------- Cartes de commande ---------- */

function carteCommande(commande, url, passee = false) {
  const du = reste(commande);
  const detail = passee
    ? `${moisAnnee(commande.dateLivraison)} · ${montant(commande.prixTotal)}`
    : `${delai(commande.dateLivraison)}${du > 0 ? ` · reste ${montant(du)}` : ''}`;
  return `
    <button class="carte-lien" data-commande="${txt(commande.id)}">
      ${vignette(url, { alt: commande.modeleNom })}
      <span class="carte-corps">
        <span class="carte-titre">${txt(commande.modeleNom)}</span>
        <span class="carte-detail">${txt(detail)}</span>
      </span>
      ${icone('chevron_right')}
    </button>`;
}

const libelleEnvoi = (envoi) => {
  const quoi = envoi.type === 'modeles'
    ? `${envoi.nombre} modèle${envoi.nombre > 1 ? 's' : ''} envoyé${envoi.nombre > 1 ? 's' : ''}`
    : 'Fiche envoyée';
  return `${quoi} ${anciennete(envoi.le)}`;
};

function initiales(nom) {
  const mots = (nom || '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  return (mots[0][0] + (mots[1]?.[0] || '')).toUpperCase();
}
