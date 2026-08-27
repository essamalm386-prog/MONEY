/* ============================================================
   ENVOI DU RECAPITULATIF
   ------------------------------------------------------------
   Un apercu, puis un bouton. La fiche est deja construite quand
   la feuille s'ouvre : demander « generer » puis « envoyer »
   ajouterait un appui sans rien apporter.

   L'envoi reste un partage assiste — l'application ouvre WhatsApp
   sur le bon numero, le couturier appuie sur envoyer. Voir
   partage.js pour la raison, qui n'est pas theorique.
   ============================================================ */

import { ecrire, nouvelId } from '../donnees.js';
import { VARIANTES, dessiner, versBlob, versPdf } from '../recap.js';
import { nomFichier, nommer, partager, texteRecap } from '../partage.js';
import { feuille, icone, message } from '../interface.js';
import { rafraichir } from '../routeur.js';

export function ouvrirRecap({ commande, client, atelier, photoUrl, variante }) {
  const forme = variante || (commande.statut === 'livree' ? 'livree' : commande.statut === 'prete' ? 'prete' : 'commande');

  const panneau = feuille({
    titre: VARIANTES[forme].titre,
    contenu: `
      <div data-apercu class="apercu-chargement">
        ${icone('receipt_long', { taille: 48 })}
        <p class="md-body-medium">Préparation de la fiche…</p>
      </div>
      <div class="pile espace-avant">
        <button class="md-btn md-btn-filled md-btn-block md-btn-lg" data-envoyer disabled>
          ${icone('send')} Envoyer par WhatsApp
        </button>
        <div class="rangee rangee-souple">
          <button class="md-btn md-btn-text" data-pdf disabled>${icone('picture_as_pdf')} PDF</button>
          <button class="md-btn md-btn-text" data-image disabled>${icone('download')} Image</button>
        </div>
      </div>
      ${client?.telephone
        ? ''
        : `<p class="md-alert md-alert-neutral espace-avant">${icone('info')}
           <span>Numéro de la cliente absent : WhatsApp s’ouvrira sans destinataire.</span></p>`}`,
  });

  preparer(panneau, { commande, client, atelier, photoUrl, forme });
  return panneau;
}

async function preparer(panneau, { commande, client, atelier, photoUrl, forme }) {
  const zone = panneau.querySelector('[data-apercu]');
  let toile;

  try {
    toile = await dessiner({ atelier, client: client || {}, commande, photoUrl, variante: forme });
  } catch (erreur) {
    zone.innerHTML = `<p class="md-alert md-alert-error">${icone('warning')}
      <span>La fiche n’a pas pu être préparée. Réessayez.</span></p>`;
    return;
  }

  /* L'apercu est une image et non le canvas lui-meme : le
     couturier peut ainsi l'enregistrer d'un appui long, comme
     n'importe quelle image de son telephone. */
  const image = new Image();
  image.className = 'apercu-recap';
  image.alt = `Récapitulatif pour ${client?.nom || 'la cliente'}`;
  image.src = toile.toDataURL('image/jpeg', 0.9);
  zone.replaceChildren(image);
  zone.classList.remove('apercu-chargement');

  const texte = texteRecap(atelier, client || {}, commande, forme);
  const boutons = panneau.querySelectorAll('button[disabled]');
  boutons.forEach((b) => { b.disabled = false; });

  panneau.querySelector('[data-envoyer]').addEventListener('click', async () => {
    const blob = await versBlob(toile, 'image/jpeg', 0.9);
    const fichier = nommer(blob, nomFichier(client || {}, commande, 'jpg'));
    const resultat = await partager({
      fichiers: [fichier],
      texte,
      telephone: client?.telephone,
      indicatif: atelier.indicatif,
      titre: VARIANTES[forme].titre,
    });

    if (resultat.voie === 'annule') return;
    if (resultat.voie === 'telechargement') {
      message('Image enregistrée — joignez-la dans WhatsApp');
    }
    await tracer({ commande, client, forme });
    panneau.close();
    rafraichir();
  });

  /* Le PDF n'est propose qu'en second : l'image s'affiche dans
     WhatsApp sans telechargement, c'est ce qui sert dans presque
     tous les cas. Le PDF est la pour les commandes importantes,
     ou la cliente veut un document a imprimer. */
  panneau.querySelector('[data-pdf]').addEventListener('click', async () => {
    const pdf = await versPdf(toile);
    await partager({
      fichiers: [nommer(pdf, nomFichier(client || {}, commande, 'pdf'))],
      texte,
      telephone: client?.telephone,
      indicatif: atelier.indicatif,
      titre: VARIANTES[forme].titre,
    });
    await tracer({ commande, client, forme });
  });

  panneau.querySelector('[data-image]').addEventListener('click', async () => {
    const blob = await versBlob(toile, 'image/jpeg', 0.92);
    const { enregistrer } = await import('../partage.js');
    enregistrer(nommer(blob, nomFichier(client || {}, commande, 'jpg')));
    message('Image enregistrée');
  });
}

/* Trace legere : une ligne dans la fiche cliente, pas un
   historique de conversation. Elle sert a une seule chose, savoir
   qu'il faut relancer. */
async function tracer({ commande, client, forme }) {
  await ecrire('commandes', { ...commande, recapEnvoyeLe: Date.now(), majLe: Date.now() });
  if (!client) return;
  await ecrire('envois', {
    id: nouvelId('env'),
    clientId: client.id,
    type: forme === 'commande' ? 'recapitulatif' : forme,
    nombre: 1,
    le: Date.now(),
  });
}
