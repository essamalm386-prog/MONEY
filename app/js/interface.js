/* ============================================================
   INTERFACE — briques de rendu partagees
   ------------------------------------------------------------
   Rien ici ne dessine un ecran : ce fichier fournit les gestes
   communs (echapper, poser une icone, ouvrir une feuille, poser
   un message) pour que les vues restent lisibles.
   ============================================================ */

import { icone } from '../../design/icones/icones.js';

export { icone };

/* Toute valeur saisie par le couturier — nom de cliente, nom de
   modele, note — traverse cette fonction avant d'entrer dans du
   HTML. Un nom contenant « < » ne doit jamais devenir une balise. */
export function txt(valeur) {
  return String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const $ = (selecteur, racine = document) => racine.querySelector(selecteur);
export const $$ = (selecteur, racine = document) => [...racine.querySelectorAll(selecteur)];

/* Delegation d'evenement : les vues se re-rendent entierement a
   chaque changement, rattacher les ecouteurs un par un les
   perdrait a chaque rendu. */
export function surClic(racine, selecteur, gestionnaire) {
  racine.addEventListener('click', (evenement) => {
    const cible = evenement.target.closest(selecteur);
    if (cible && racine.contains(cible)) gestionnaire(cible, evenement);
  });
}

/* ---------- Messages ----------
   « Document enregistre », pas « Votre document a bien ete
   enregistre avec succes ». Si le message s'affiche, ca a marche. */

let minuteurMessage;

export function message(texte, { erreur = false } = {}) {
  let zone = $('#message');
  if (!zone) {
    zone = document.createElement('div');
    zone.id = 'message';
    zone.setAttribute('role', 'status');
    zone.setAttribute('aria-live', 'polite');
    document.body.append(zone);
  }
  zone.className = erreur ? 'message message-erreur visible' : 'message visible';
  zone.textContent = texte;
  clearTimeout(minuteurMessage);
  minuteurMessage = setTimeout(() => zone.classList.remove('visible'), 3200);
}

/* ---------- Dialogue de confirmation ----------
   Titre : une question courte. Corps : la seule consequence
   irreversible. Deux actions, pas trois. */

export function confirmer({ titre, corps = '', action, danger = false }) {
  return new Promise((resoudre) => {
    const dialogue = document.createElement('dialog');
    dialogue.className = 'md-dialog';
    dialogue.innerHTML = `
      <h2 class="md-dialog-title">${txt(titre)}</h2>
      ${corps ? `<p class="md-dialog-body">${txt(corps)}</p>` : ''}
      <div class="md-dialog-actions">
        <button class="md-btn md-btn-text" value="non">Annuler</button>
        <button class="md-btn ${danger ? 'md-btn-danger' : 'md-btn-filled'}" value="oui">${txt(action)}</button>
      </div>`;
    document.body.append(dialogue);
    dialogue.addEventListener('click', (evenement) => {
      const bouton = evenement.target.closest('button');
      if (bouton) dialogue.close(bouton.value);
    });
    dialogue.addEventListener('close', () => {
      resoudre(dialogue.returnValue === 'oui');
      dialogue.remove();
    });
    dialogue.showModal();
  });
}

/* ---------- Feuille glissante ----------
   Sur telephone, une feuille qui monte du bas garde le pouce a
   portee et le contexte visible derriere. Sert au choix d'un
   modele, d'une cliente, d'un statut. */

export function feuille({ titre, contenu, surOuverture }) {
  const dialogue = document.createElement('dialog');
  dialogue.className = 'feuille';
  dialogue.innerHTML = `
    <div class="feuille-poignee" aria-hidden="true"></div>
    <header class="feuille-entete">
      <h2 class="md-title-large">${txt(titre)}</h2>
      <button class="md-icon-btn" data-fermer aria-label="Fermer">${icone('close')}</button>
    </header>
    <div class="feuille-corps">${contenu}</div>`;
  document.body.append(dialogue);
  dialogue.addEventListener('click', (evenement) => {
    if (evenement.target.closest('[data-fermer]')) dialogue.close();
    /* Un clic sur le fond ferme : le geste attendu sur telephone. */
    if (evenement.target === dialogue) dialogue.close();
  });
  dialogue.addEventListener('close', () => dialogue.remove());
  dialogue.showModal();
  surOuverture?.(dialogue);
  return dialogue;
}

/* ---------- Etat vide ----------
   Dire pourquoi c'est vide et comment le remplir. Le seul endroit
   ou deux phrases sont legitimes. */

export function etatVide({ icone: nom, titre, action = '' }) {
  return `
    <div class="etat-vide">
      ${icone(nom, { taille: 48 })}
      <p class="md-body-large">${txt(titre)}</p>
      ${action}
    </div>`;
}

/* ---------- Photo de modele ----------
   Une commande sans photo reste utilisable : la vignette retombe
   sur un aplat neutre plutot que sur une image cassee. */

export function vignette(url, { classe = '', alt = '' } = {}) {
  if (url) return `<img class="vignette ${classe}" src="${txt(url)}" alt="${txt(alt)}" loading="lazy">`;
  return `<div class="vignette vignette-absente ${classe}" role="img" aria-label="Sans photo">
    ${icone('checkroom', { taille: 24 })}
  </div>`;
}

/* ---------- Champ numerique ----------
   inputmode declenche le pave numerique du telephone. Sans lui, le
   couturier tape un prix sur un clavier alphabetique, ce qui suffit
   a lui faire preferer son cahier. */

export function champNombre({ id, libelle, valeur = '', suffixe = '', aide = '', requis = false }) {
  return `
    <div class="md-field">
      <label class="md-label" for="${id}">${txt(libelle)}${requis ? ' <span class="requis">obligatoire</span>' : ''}</label>
      <div class="champ-suffixe">
        <input id="${id}" name="${id}" class="md-input" type="text" inputmode="numeric"
               pattern="[0-9 ]*" value="${txt(valeur)}" autocomplete="off">
        ${suffixe ? `<span class="suffixe" aria-hidden="true">${txt(suffixe)}</span>` : ''}
      </div>
      ${aide ? `<p class="md-help">${txt(aide)}</p>` : ''}
    </div>`;
}

/* Lit un champ numerique en tolerant les espaces de saisie. */
export const nombre = (valeur) => {
  const propre = String(valeur ?? '').replace(/[^\d]/g, '');
  return propre ? Number(propre) : 0;
};

/* ---------- Retour haptique ----------
   Un changement de statut se fait souvent sans regarder l'ecran,
   les mains occupees. La vibration confirme l'appui. */
export const vibrer = (duree = 12) => {
  try { navigator.vibrate?.(duree); } catch { /* non supporte, sans consequence */ }
};
