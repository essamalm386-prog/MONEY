/* ============================================================
   RAPPELS — un resume par jour, jamais plus
   ------------------------------------------------------------
   C'est la fonction que le cahier ne pourra jamais imiter : le
   couturier ne programme rien, il note une date de livraison et
   l'application vient le chercher.

   Deux garde-fous, tenus ici :
   — Une notification par jour au maximum. Un resume du matin,
     jamais une alerte par commande.
   — Rien a dire, rien a envoyer. Une journee calme ne declenche
     aucune notification.

   Limite assumee et dite telle quelle a l'utilisateur : sans
   serveur, le resume part a la premiere ouverture de la journee,
   pas a une heure fixe. Le prix a payer pour une application qui
   n'envoie aucune donnee nulle part.
   ============================================================ */

import { ecrireAtelier, lireAtelier, lireTout } from './donnees.js';
import { resumeDuJour, texteResume, versISO, aujourdhui } from './metier.js';

export function etatNotifications() {
  if (!('Notification' in window)) return 'indisponible';
  if (Notification.permission === 'granted') return 'accorde';
  if (Notification.permission === 'denied') return 'refuse';
  return 'a_demander';
}

export async function demanderNotifications() {
  if (!('Notification' in window)) return false;
  const reponse = await Notification.requestPermission();
  return reponse === 'granted';
}

/* Appele une fois au demarrage. Rend le resume calcule pour que
   l'ecran d'accueil et la notification ne puissent pas diverger. */
export async function resumeDuMatin() {
  const [commandes, atelier] = await Promise.all([lireTout('commandes'), lireAtelier()]);
  const resume = resumeDuJour(commandes);
  const ceJour = versISO(aujourdhui());

  if (atelier.dernierResume === ceJour) return resume;
  if (etatNotifications() !== 'accorde') return resume;

  const texte = texteResume(resume);
  if (!texte) {
    /* Journee calme : on marque le jour comme traite pour ne pas
       reevaluer a chaque ouverture, mais on n'envoie rien. */
    await ecrireAtelier({ ...atelier, dernierResume: ceJour });
    return resume;
  }

  await notifier(texte);
  await ecrireAtelier({ ...atelier, dernierResume: ceJour });
  return resume;
}

async function notifier(corps) {
  const options = {
    body: corps,
    icon: 'app/img/icone-192.png',
    badge: 'app/img/icone-192.png',
    tag: 'resume-du-jour',
    /* renotify false : le meme resume ne doit pas revibrer si la
       notification est encore affichee. */
    renotify: false,
  };

  try {
    const inscription = await navigator.serviceWorker?.ready;
    if (inscription) {
      await inscription.showNotification('Aujourd’hui', options);
      return;
    }
  } catch { /* pas de service worker : notification directe */ }

  try {
    new Notification('Aujourd’hui', options);
  } catch { /* le navigateur exige un service worker */ }
}
