/* ============================================================
   AUJOURD'HUI — l'ecran d'ouverture
   ------------------------------------------------------------
   Le couturier ouvre l'application le matin et voit sa journee,
   sans rien chercher. Un bloc par chose a faire, un chiffre par
   bloc, chaque bloc ouvre la liste correspondante.

   Le test : en trois secondes, sans lire attentivement, savoir
   s'il est en retard. Tout ce qui demande un effort de lecture
   n'a pas sa place ici — pas de graphique, pas de statistique,
   pas de menu a explorer.
   ============================================================ */

import { lireAtelier, lireTout } from '../donnees.js';
import { dateLongue, majusculeInitiale, montant, resumeDuJour, versISO } from '../metier.js';
import { etatVide, icone, txt } from '../interface.js';
import { aller } from '../routeur.js';

export async function vueAujourdhui() {
  const [commandes, clients, atelier] = await Promise.all([
    lireTout('commandes'),
    lireTout('clients'),
    lireAtelier(),
  ]);
  const parId = new Map(clients.map((c) => [c.id, c]));
  const resume = resumeDuJour(commandes);
  const nom = (commande) => parId.get(commande.clientId)?.nom || 'Cliente';

  const section = document.createElement('div');
  section.className = 'pile';

  if (!commandes.length) {
    section.innerHTML = `
      ${entete(atelier)}
      ${etatVide({
        icone: 'checkroom',
        titre: 'Aucune commande pour l’instant.',
        action: `<button class="md-btn md-btn-filled" data-action="commencer">
                   ${icone('add')} Première commande
                 </button>`,
      })}`;
    section.querySelector('[data-action="commencer"]').addEventListener('click', () => aller('/commande/nouvelle'));
    return section;
  }

  /* Les trois premieres lignes citent un ou deux noms. Un chiffre
     seul dit qu'il y a un probleme ; un nom dit lequel. */
  const noms = (entrees, limite = 2) => {
    const listes = entrees.slice(0, limite).map((x) => `${x.commande.modeleNom} — ${nom(x.commande)}`);
    const surplus = entrees.length - listes.length;
    return listes.join(' · ') + (surplus > 0 ? ` · +${surplus}` : '');
  };

  const blocs = [];

  if (resume.retard.length) {
    blocs.push(bloc({
      classe: 'bloc-retard',
      compte: resume.retard.length,
      libelle: resume.retard.length === 1 ? 'commande en retard' : 'commandes en retard',
      detail: noms(resume.retard),
      destination: '/commandes?filtre=retard',
      nomIcone: 'priority_high',
    }));
  }

  if (resume.livraisons.length) {
    blocs.push(bloc({
      classe: 'bloc-livraison',
      compte: resume.livraisons.length,
      libelle: resume.livraisons.length === 1 ? 'livraison aujourd’hui' : 'livraisons aujourd’hui',
      detail: noms(resume.livraisons),
      destination: '/commandes?filtre=aujourdhui',
      nomIcone: 'inventory_2',
    }));
  }

  if (resume.aCommencer.length) {
    blocs.push(bloc({
      compte: resume.aCommencer.length,
      libelle: resume.aCommencer.length === 1 ? 'vêtement à commencer' : 'vêtements à commencer',
      detail: 'pour tenir les délais de la semaine',
      destination: '/commandes?filtre=a_commencer',
      nomIcone: 'content_cut',
    }));
  }

  if (resume.enConfection.length) {
    blocs.push(bloc({
      compte: resume.enConfection.length,
      libelle: 'en cours de confection',
      destination: '/commandes?filtre=en_confection',
      nomIcone: 'iron',
    }));
  }

  if (resume.pretes.length) {
    blocs.push(bloc({
      compte: resume.pretes.length,
      libelle: resume.pretes.length === 1 ? 'prête à récupérer' : 'prêtes à récupérer',
      detail: 'la cliente peut être prévenue',
      destination: '/commandes?filtre=prete',
      nomIcone: 'check_circle',
    }));
  }

  const corps = resume.calme && !blocs.length ? journeeCalme(resume) : blocs.join('');

  section.innerHTML = `
    ${entete(atelier)}
    ${corps}
    ${resume.aEncaisser > 0 ? argent(resume) : ''}`;

  section.addEventListener('click', (evenement) => {
    const cible = evenement.target.closest('[data-destination]');
    if (cible) aller(cible.dataset.destination);
  });

  return section;
}

const entete = (atelier) => `
  <header class="jour-entete">
    <h1 class="md-headline-large">Aujourd’hui</h1>
    <p class="jour-date md-body-large">${txt(majusculeInitiale(dateLongue(versISO(new Date()))))}</p>
    ${atelier.nom ? '' : rappelAtelier()}
  </header>`;

/* La fiche atelier se remplit une fois et ressert a vie sur tous
   les envois. Tant qu'elle est vide, le recapitulatif partirait
   sans nom ni numero — donc sans le seul canal d'acquisition
   gratuit du produit. */
const rappelAtelier = () => `
  <button class="md-alert alerte-cliquable" data-destination="/atelier">
    ${icone('storefront')}
    <span>
      <span class="md-alert-title">Nom de l’atelier à renseigner</span>
      Il apparaît sur les fiches envoyées aux clientes.
    </span>
  </button>`;

function bloc({ classe = '', compte, libelle, detail = '', destination, nomIcone }) {
  return `
    <button class="bloc ${classe}" data-destination="${txt(destination)}">
      <span class="bloc-compte">${compte}</span>
      <span class="bloc-corps">
        <span class="bloc-libelle">${txt(libelle)}</span>
        ${detail ? `<span class="bloc-detail">${txt(detail)}</span>` : ''}
      </span>
      ${icone(nomIcone, { taille: 24 })}
    </button>`;
}

const argent = (resume) => `
  <button class="bloc bloc-argent" data-destination="/commandes?filtre=impayees">
    <span class="bloc-corps">
      <span class="bloc-libelle">Reste à encaisser</span>
      <span class="bloc-detail">sur ${resume.nbImpayees} commande${resume.nbImpayees > 1 ? 's' : ''}</span>
    </span>
    <span class="bloc-compte">${txt(montant(resume.aEncaisser))}</span>
  </button>`;

const journeeCalme = (resume) => `
  <div class="journee-calme">
    ${icone('sentiment_satisfied', { taille: 48 })}
    <p class="md-title-medium">Rien d’urgent aujourd’hui</p>
    <p class="md-body-medium">
      ${resume.enCours
        ? `${resume.enCours} commande${resume.enCours > 1 ? 's' : ''} en cours, aucune échéance proche.`
        : 'Aucune commande en cours.'}
    </p>
  </div>`;
