/* ============================================================
   CATALOGUE — l'etagere rangee du savoir-faire
   ------------------------------------------------------------
   Aujourd'hui les photos de modeles sont eparpillees : galerie du
   telephone, discussions WhatsApp, captures d'ecran. Quand une
   cliente demande « montrez-moi ce que vous faites », le couturier
   fait defiler sa galerie en passant devant des photos de famille.

   Trois informations par modele, pas plus : une photo, un nom
   court, un prix indicatif. Le prix est toujours « a partir de » —
   le tarif reel depend du tissu et des finitions, et afficher un
   prix ferme mettrait le couturier en difficulte face a une
   cliente qui le brandit.
   ============================================================ */

import {
  ajouterPhoto, blobPhoto, ecrire, lireAtelier, lireTout, nouvelId, supprimer, urlPhoto,
} from '../donnees.js';
import { CATEGORIES, correspond, montant } from '../metier.js';
import { confirmer, etatVide, feuille, icone, message, txt, vignette } from '../interface.js';
import { capturer } from '../photo.js';
import { nommer, partager, texteModeles } from '../partage.js';
import { rafraichir } from '../routeur.js';

export async function vueModeles(_, recherche) {
  const categorie = recherche?.get('categorie') || '';
  const modeles = await lireTout('modeles');
  const visibles = categorie ? modeles.filter((m) => m.categorie === categorie) : modeles;
  visibles.sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));

  const urls = new Map(await Promise.all(visibles.map(async (m) => [m.id, await urlPhoto(m.photoId)])));

  /* La selection sert a envoyer deux ou trois modeles a une
     cliente. Elle est volontairement en memoire et remise a zero
     a chaque visite : une selection qui survit fait envoyer par
     erreur des modeles choisis la semaine derniere. */
  const selection = new Set();

  const section = document.createElement('div');

  const dessiner = () => {
    section.innerHTML = `
      <div class="filtres">
        <button class="md-chip md-chip-filter ${categorie ? '' : 'md-chip-selected'}" data-categorie="">Tous</button>
        ${CATEGORIES.map((c) => `
          <button class="md-chip md-chip-filter ${categorie === c.cle ? 'md-chip-selected' : ''}"
                  data-categorie="${c.cle}">${txt(c.libelle)}</button>`).join('')}
      </div>

      ${visibles.length ? `
        <div class="grille-modeles">
          ${visibles.map((modele) => `
            <button class="carte-modele" data-modele="${txt(modele.id)}"
                    aria-pressed="${selection.has(modele.id)}">
              ${vignette(urls.get(modele.id), { alt: modele.nom })}
              ${selection.has(modele.id) ? `<span class="coche">${icone('check', { taille: 20 })}</span>` : ''}
              <span class="carte-modele-nom">${txt(modele.nom)}</span>
              ${modele.prixIndicatif
                ? `<span class="carte-modele-prix">à partir de ${txt(montant(modele.prixIndicatif))}</span>`
                : ''}
            </button>`).join('')}
        </div>`
        : etatVide({
            icone: 'photo_library',
            titre: categorie
              ? 'Aucun modèle dans cette catégorie.'
              : 'Le catalogue se remplit à chaque livraison. Vous pouvez aussi ajouter un modèle maintenant.',
            action: `<button class="md-btn md-btn-filled" data-ajouter>${icone('add')} Ajouter un modèle</button>`,
          })}

      ${selection.size ? barreSelection(selection.size) : ''}`;

    /* Signale la barre d'action a la coquille, qui efface alors le
       bouton flottant (voir app.css). */
    if (selection.size) document.body.dataset.actionEnCours = 'oui';
    else delete document.body.dataset.actionEnCours;
  };

  /* Le bouton flottant de l'ecran ouvre la fiche d'un nouveau
     modele (voir BOUTON dans app.js). */
  section.addEventListener('action-principale', () => ouvrirModele(null));

  section.addEventListener('click', async (evenement) => {
    if (evenement.target.closest('[data-ajouter]')) {
      ouvrirModele(null);
      return;
    }

    const chip = evenement.target.closest('[data-categorie]');
    if (chip) {
      const cle = chip.dataset.categorie;
      window.location.hash = cle ? `/modeles?categorie=${cle}` : '/modeles';
      return;
    }

    if (evenement.target.closest('[data-annuler-selection]')) {
      selection.clear();
      dessiner();
      return;
    }

    if (evenement.target.closest('[data-envoyer-selection]')) {
      const choisis = visibles.filter((m) => selection.has(m.id));
      await ouvrirEnvoi(choisis, () => {
        selection.clear();
        dessiner();
      });
      return;
    }

    const carte = evenement.target.closest('[data-modele]');
    if (!carte) return;
    const modele = visibles.find((m) => m.id === carte.dataset.modele);
    /* Une selection en cours : l'appui coche au lieu d'ouvrir. */
    if (selection.size) {
      basculer(selection, modele.id);
      dessiner();
      return;
    }
    ouvrirModele(modele, urls.get(modele.id));
  });

  /* Appui long pour entrer en selection — le geste attendu sur
     telephone pour choisir plusieurs elements. */
  let minuteur;
  const demarrerAppui = (evenement) => {
    const carte = evenement.target.closest('[data-modele]');
    if (!carte) return;
    minuteur = setTimeout(() => {
      basculer(selection, carte.dataset.modele);
      navigator.vibrate?.(16);
      dessiner();
    }, 450);
  };
  const arreterAppui = () => clearTimeout(minuteur);
  section.addEventListener('pointerdown', demarrerAppui);
  section.addEventListener('pointerup', arreterAppui);
  section.addEventListener('pointercancel', arreterAppui);
  section.addEventListener('pointermove', arreterAppui);
  section.addEventListener('contextmenu', (evenement) => {
    if (evenement.target.closest('[data-modele]')) evenement.preventDefault();
  });

  dessiner();
  return section;
}

const basculer = (selection, id) => (selection.has(id) ? selection.delete(id) : selection.add(id));

const barreSelection = (nombre) => `
  <div class="barre-action">
    <div class="barre-action-total">
      <strong>${nombre} modèle${nombre > 1 ? 's' : ''}</strong>
    </div>
    <button class="md-btn md-btn-text" data-annuler-selection>Annuler</button>
    <button class="md-btn md-btn-filled" data-envoyer-selection>${icone('send')} Envoyer</button>
  </div>`;

/* ---------- Fiche modele ---------- */

function ouvrirModele(modele, url) {
  const existe = Boolean(modele);
  let photoId = modele?.photoId || null;
  let photoUrl = url || null;

  const panneau = feuille({
    titre: existe ? modele.nom : 'Nouveau modèle',
    contenu: gabaritModele(modele, photoUrl, existe),
  });

  const redessiner = () => {
    panneau.querySelector('.feuille-corps').innerHTML = gabaritModele(
      { ...modele, nom: valeur('#mo-nom'), prixIndicatif: valeur('#mo-prix'), categorie: valeurCategorie() },
      photoUrl,
      existe,
    );
    brancher();
  };

  const valeur = (selecteur) => panneau.querySelector(selecteur)?.value || '';
  const valeurCategorie = () => panneau.querySelector('[data-categorie-choisie="oui"]')?.dataset.cat || '';

  function brancher() {
    panneau.querySelector('[data-photo]')?.addEventListener('click', async () => {
      const id = await capturer(ajouterPhoto, { camera: false });
      if (!id) return;
      photoId = id;
      photoUrl = await urlPhoto(id);
      redessiner();
    });

    for (const chip of panneau.querySelectorAll('[data-cat]')) {
      chip.addEventListener('click', () => {
        const deja = chip.dataset.categorieChoisie === 'oui';
        for (const autre of panneau.querySelectorAll('[data-cat]')) {
          autre.dataset.categorieChoisie = 'non';
          autre.classList.remove('md-chip-selected');
        }
        if (!deja) {
          chip.dataset.categorieChoisie = 'oui';
          chip.classList.add('md-chip-selected');
        }
      });
    }

    panneau.querySelector('[data-valider]').addEventListener('click', async () => {
      const nom = valeur('#mo-nom').trim();
      if (!nom) {
        message('Nom du modèle obligatoire', { erreur: true });
        return;
      }
      await ecrire('modeles', {
        id: modele?.id || nouvelId('mod'),
        nom,
        categorie: valeurCategorie(),
        prixIndicatif: Number(valeur('#mo-prix').replace(/[^\d]/g, '')) || 0,
        photoId,
        creeLe: modele?.creeLe || Date.now(),
        majLe: Date.now(),
      });
      panneau.close();
      message(existe ? 'Modèle modifié' : 'Modèle ajouté');
      rafraichir();
    });

    panneau.querySelector('[data-supprimer]')?.addEventListener('click', async () => {
      const confirme = await confirmer({
        titre: 'Retirer ce modèle du catalogue ?',
        corps: 'Les commandes qui l’utilisent gardent leur photo.',
        action: 'Retirer',
        danger: true,
      });
      if (!confirme) return;
      await supprimer('modeles', modele.id);
      panneau.close();
      message('Modèle retiré');
      rafraichir();
    });
  }

  brancher();
}

const gabaritModele = (modele, photoUrl, existe) => `
  ${photoUrl
    ? vignette(photoUrl, { classe: 'vignette-large', alt: modele?.nom || 'Modèle' })
    : `<div class="vignette vignette-absente vignette-large">${icone('checkroom', { taille: 48 })}</div>`}
  <button class="md-btn md-btn-outlined md-btn-block espace-avant" data-photo>
    ${icone(photoUrl ? 'edit' : 'add_photo_alternate')} ${photoUrl ? 'Changer la photo' : 'Ajouter une photo'}
  </button>

  <div class="md-field espace-avant">
    <label class="md-label" for="mo-nom">Nom</label>
    <input id="mo-nom" class="md-input" autocomplete="off" value="${txt(modele?.nom || '')}">
  </div>

  <div class="md-field">
    <label class="md-label" for="mo-prix">Prix indicatif</label>
    <div class="champ-suffixe">
      <input id="mo-prix" class="md-input" inputmode="numeric" value="${txt(modele?.prixIndicatif || '')}">
      <span class="suffixe" aria-hidden="true">F</span>
    </div>
    <p class="md-help">Affiché « à partir de », modifiable à chaque commande.</p>
  </div>

  <p class="md-label espace-apres-court">Catégorie</p>
  <div class="raccourcis">
    ${CATEGORIES.map((c) => `
      <button class="md-chip md-chip-filter ${modele?.categorie === c.cle ? 'md-chip-selected' : ''}"
              data-cat="${c.cle}" data-categorie-choisie="${modele?.categorie === c.cle ? 'oui' : 'non'}">
        ${txt(c.libelle)}
      </button>`).join('')}
  </div>

  <button class="md-btn md-btn-filled md-btn-block espace-avant" data-valider>Enregistrer</button>
  ${existe ? `<button class="md-btn md-btn-text md-btn-block" data-supprimer>Retirer du catalogue</button>` : ''}`;

/* ---------- Envoi de modeles a une cliente ----------
   Une cliente, choisie, a un moment choisi. Pas de selection
   multiple de clientes, pas d'envoi programme, pas de campagne :
   WhatsApp suspend les numeros qui font de l'envoi en masse, et
   un couturier dont le numero professionnel est bloque perd sa
   clientele du jour au lendemain.
   ============================================================ */

async function ouvrirEnvoi(modeles, apresEnvoi) {
  const [clients, atelier] = await Promise.all([lireTout('clients'), lireAtelier()]);

  const panneau = feuille({
    titre: `Envoyer ${modeles.length} modèle${modeles.length > 1 ? 's' : ''}`,
    contenu: `
      <div class="recherche">
        ${icone('search')}
        <input class="md-input" type="search" id="envoi-recherche" autocomplete="off"
               inputmode="search" aria-label="Nom ou quatre derniers chiffres">
      </div>
      <p class="md-help espace-apres">Une cliente à la fois.</p>
      <div data-resultats></div>`,
    surOuverture: (dialogue) => dialogue.querySelector('#envoi-recherche').focus(),
  });

  const champ = panneau.querySelector('#envoi-recherche');
  const zone = panneau.querySelector('[data-resultats]');

  const afficher = () => {
    const trouves = clients.filter((c) => correspond(c, champ.value)).slice(0, 30);
    zone.innerHTML = trouves.length
      ? trouves.map((c) => `
          <button class="carte-lien" data-client="${txt(c.id)}">
            <span class="carte-corps">
              <span class="carte-titre">${txt(c.nom)}</span>
              <span class="carte-detail">${txt(c.telephone || 'Numéro non renseigné')}</span>
            </span>
            ${icone('send')}
          </button>`).join('')
      : etatVide({ icone: 'group', titre: 'Aucune cliente à ce nom.' });
  };

  champ.addEventListener('input', afficher);
  afficher();

  zone.addEventListener('click', async (evenement) => {
    const bouton = evenement.target.closest('[data-client]');
    if (!bouton) return;
    const client = clients.find((c) => c.id === bouton.dataset.client);

    const fichiers = [];
    for (const modele of modeles) {
      const blob = await blobPhoto(modele.photoId);
      if (blob) fichiers.push(nommer(blob, `${modele.nom.replace(/[^\w]+/g, '-').toLowerCase()}.jpg`));
    }

    const resultat = await partager({
      fichiers,
      texte: texteModeles(atelier, client, modeles),
      telephone: client.telephone,
      indicatif: atelier.indicatif,
      titre: 'Modèles',
    });

    if (resultat.voie === 'annule') return;
    if (resultat.voie === 'telechargement') message('Photos enregistrées — joignez-les dans WhatsApp');

    await ecrire('envois', {
      id: nouvelId('env'),
      clientId: client.id,
      type: 'modeles',
      nombre: modeles.length,
      le: Date.now(),
    });
    panneau.close();
    apresEnvoi();
  });
}
