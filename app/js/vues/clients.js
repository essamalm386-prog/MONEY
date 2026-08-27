/* ============================================================
   CLIENTES — la recherche en trois secondes
   ------------------------------------------------------------
   Une cliente revient apres six mois : au cahier, ses mesures
   sont trois cahiers en arriere, et en pratique le couturier
   remesure. Ici on tape un nom ou les quatre derniers chiffres
   d'un numero, et la fiche apparait.
   ============================================================ */

import { lireTout } from '../donnees.js';
import { correspond, normaliser, reste } from '../metier.js';
import { etatVide, icone, txt } from '../interface.js';
import { aller } from '../routeur.js';

export async function vueClients() {
  const [clients, commandes] = await Promise.all([lireTout('clients'), lireTout('commandes')]);

  /* Ce qui compte dans une liste de clientes : qui a une commande
     en cours, et qui doit encore de l'argent. */
  const parClient = new Map();
  for (const commande of commandes) {
    const entree = parClient.get(commande.clientId) || { total: 0, enCours: 0, du: 0, derniere: 0 };
    entree.total += 1;
    if (commande.statut !== 'livree') entree.enCours += 1;
    entree.du += reste(commande);
    entree.derniere = Math.max(entree.derniere, commande.creeLe || 0);
    parClient.set(commande.clientId, entree);
  }

  const tries = [...clients].sort((a, b) => {
    const da = parClient.get(a.id)?.derniere || a.creeLe || 0;
    const db = parClient.get(b.id)?.derniere || b.creeLe || 0;
    return db - da;
  });

  const section = document.createElement('div');
  section.innerHTML = `
    <div class="recherche">
      ${icone('search')}
      <input class="md-input" type="search" id="recherche-clients" enterkeyhint="search"
             inputmode="search" autocomplete="off" aria-label="Nom ou quatre derniers chiffres">
    </div>
    <div data-liste></div>`;

  const champ = section.querySelector('#recherche-clients');
  const liste = section.querySelector('[data-liste]');

  const afficher = () => {
    const requete = champ.value;
    const trouves = tries.filter((c) => correspond(c, requete));

    if (!trouves.length) {
      liste.innerHTML = clients.length
        ? etatVide({
            icone: 'group',
            titre: 'Aucune cliente à ce nom.',
            action: `<button class="md-btn md-btn-tonal" data-creer>${icone('person_add')} Nouvelle commande</button>`,
          })
        : etatVide({
            icone: 'group',
            titre: 'Les clientes s’ajoutent en créant une commande.',
            action: `<button class="md-btn md-btn-filled" data-creer>${icone('add')} Première commande</button>`,
          });
      return;
    }

    liste.innerHTML = trouves.map((client) => {
      const stat = parClient.get(client.id) || { total: 0, enCours: 0, du: 0 };
      const details = [
        client.telephone,
        stat.enCours ? `${stat.enCours} en cours` : null,
        stat.du > 0 ? 'solde à encaisser' : null,
      ].filter(Boolean).join(' · ');

      return `
        <button class="carte-lien" data-client="${txt(client.id)}">
          <span class="pastille" aria-hidden="true">${txt(initiales(client.nom))}</span>
          <span class="carte-corps">
            <span class="carte-titre">${txt(client.nom)}</span>
            <span class="carte-detail">${txt(details || 'Aucune commande')}</span>
          </span>
          ${stat.du > 0 ? `<span class="md-badge md-badge-error">Impayé</span>` : ''}
          ${icone('chevron_right')}
        </button>`;
    }).join('');
  };

  champ.addEventListener('input', afficher);
  section.addEventListener('click', (evenement) => {
    if (evenement.target.closest('[data-creer]')) {
      aller('/commande/nouvelle');
      return;
    }
    const carte = evenement.target.closest('[data-client]');
    if (carte) aller(`/client/${carte.dataset.client}`);
  });

  afficher();
  return section;
}

/* Une pastille de deux lettres plutot qu'une photo : personne ne
   photographie ses clientes, et une liste d'avatars vides est
   plus bruyante qu'utile. */
export function initiales(nom) {
  const mots = normaliser(nom).split(/\s+/).filter(Boolean);
  if (!mots.length) return '?';
  return (mots[0][0] + (mots[1]?.[0] || '')).toUpperCase();
}
