/* ============================================================
   LISTE DES COMMANDES
   ------------------------------------------------------------
   Les filtres reprennent exactement les blocs d'« Aujourd'hui » :
   cliquer sur « 2 commandes en retard » doit amener sur ces deux
   commandes-la, pas sur une liste ou il faut les rechercher.
   ============================================================ */

import { lireTout } from '../donnees.js';
import { STATUTS, delai, etat, montant, reste } from '../metier.js';
import { etatVide, icone, txt } from '../interface.js';
import { aller } from '../routeur.js';

const FILTRES = [
  { cle: 'en_cours', libelle: 'En cours' },
  { cle: 'retard', libelle: 'En retard' },
  { cle: 'aujourdhui', libelle: 'Aujourd’hui' },
  { cle: 'a_commencer', libelle: STATUTS.a_commencer.libelle },
  { cle: 'en_confection', libelle: STATUTS.en_confection.libelle },
  { cle: 'prete', libelle: STATUTS.prete.libelle },
  { cle: 'impayees', libelle: 'Impayées' },
  { cle: 'toutes', libelle: 'Toutes' },
];

const GARDE = {
  en_cours: (c) => c.commande.statut !== 'livree',
  retard: (c) => c.etat.enRetard,
  aujourdhui: (c) => c.etat.livraisonAujourdhui,
  a_commencer: (c) => c.commande.statut === 'a_commencer',
  en_confection: (c) => c.commande.statut === 'en_confection',
  prete: (c) => c.commande.statut === 'prete',
  impayees: (c) => c.etat.reste > 0,
  toutes: () => true,
};

export async function vueCommandes(_, recherche) {
  const filtre = FILTRES.some((f) => f.cle === recherche?.get('filtre'))
    ? recherche.get('filtre')
    : 'en_cours';

  const [commandes, clients] = await Promise.all([lireTout('commandes'), lireTout('clients')]);
  const parId = new Map(clients.map((c) => [c.id, c]));

  const enrichies = commandes.map((commande) => ({ commande, etat: etat(commande) }));
  const visibles = enrichies.filter(GARDE[filtre]).sort(trier);

  const section = document.createElement('div');
  section.innerHTML = `
    <div class="filtres" role="tablist">
      ${FILTRES.map((f) => {
        const nombre = enrichies.filter(GARDE[f.cle]).length;
        return `
          <button class="md-chip md-chip-filter ${f.cle === filtre ? 'md-chip-selected' : ''}"
                  role="tab" aria-selected="${f.cle === filtre}" data-filtre="${f.cle}">
            ${txt(f.libelle)}${nombre ? ` <span class="md-badge md-badge-neutral">${nombre}</span>` : ''}
          </button>`;
      }).join('')}
    </div>
    ${visibles.length
      ? visibles.map((x) => carte(x, parId.get(x.commande.clientId))).join('')
      : etatVide({ icone: 'checkroom', titre: messageVide(filtre) })}`;

  section.addEventListener('click', (evenement) => {
    const chip = evenement.target.closest('[data-filtre]');
    if (chip) {
      aller(`/commandes?filtre=${chip.dataset.filtre}`);
      return;
    }
    const carte = evenement.target.closest('[data-commande]');
    if (carte) aller(`/commande/${carte.dataset.commande}`);
  });

  return section;
}

/* Le plus urgent en haut, toujours : une liste triee par date de
   creation obligerait a la parcourir en entier pour trouver ce
   qui brule. */
function trier(a, b) {
  const rang = (x) => (x.commande.statut === 'livree' ? 1 : 0);
  if (rang(a) !== rang(b)) return rang(a) - rang(b);
  return (a.etat.restants ?? 9999) - (b.etat.restants ?? 9999);
}

function carte({ commande, etat: situation }, client) {
  const du = reste(commande);
  const statut = STATUTS[commande.statut];
  const classeEcheance = situation.enRetard
    ? 'echeance-retard'
    : situation.livraisonAujourdhui || situation.aCommencer ? 'echeance-proche' : '';

  return `
    <button class="carte-lien" data-commande="${txt(commande.id)}">
      <span class="jeton-statut" data-statut="${txt(commande.statut)}" aria-hidden="true">
        ${icone(statut.icone, { taille: 20 })}
      </span>
      <span class="carte-corps">
        <span class="carte-titre">${txt(commande.modeleNom)}</span>
        <span class="carte-detail">${txt(client?.nom || 'Cliente supprimée')}${
          du > 0 ? ` · reste ${txt(montant(du))}` : ''}</span>
      </span>
      <span class="echeance ${classeEcheance}">
        ${commande.statut === 'livree' ? 'Livrée' : txt(delai(commande.dateLivraison))}
      </span>
    </button>`;
}

const messageVide = (filtre) =>
  ({
    en_cours: 'Aucune commande en cours.',
    retard: 'Aucun retard.',
    aujourdhui: 'Aucune livraison aujourd’hui.',
    impayees: 'Tout est encaissé.',
    toutes: 'Aucune commande enregistrée.',
  })[filtre] || `Aucune commande à ce stade.`;
