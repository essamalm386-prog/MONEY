/* ============================================================
   PARTAGE — WhatsApp assiste, jamais automatise
   ------------------------------------------------------------
   L'application prepare l'image et le texte, puis ouvre le
   partage du telephone sur le bon numero. C'est le couturier qui
   appuie sur « envoyer ».

   Ce choix n'est pas de la prudence de principe. WhatsApp suspend
   les numeros qui envoient en masse sans sollicitation, et un
   couturier dont le numero professionnel est bloque perd son
   carnet d'adresses du jour au lendemain. Une seule cliente, un
   seul envoi, decide sur le moment : pas de selection multiple,
   pas de programmation, pas de campagne.
   ============================================================ */

import { montant } from './metier.js';

/* wa.me attend un numero international sans signe ni espace.
   L'indicatif de l'atelier comble les numeros notes en local,
   qui sont la quasi-totalite des numeros d'un carnet de quartier. */
export function numeroInternational(telephone, indicatif = '') {
  const brut = (telephone || '').replace(/[^\d+]/g, '');
  if (!brut) return '';
  if (brut.startsWith('+')) return brut.slice(1);
  if (brut.startsWith('00')) return brut.slice(2);
  const prefixe = (indicatif || '').replace(/\D/g, '');
  if (prefixe && brut.startsWith(prefixe)) return brut;
  return `${prefixe}${brut}`;
}

export const lienWhatsApp = (telephone, texte, indicatif) => {
  const numero = numeroInternational(telephone, indicatif);
  const message = encodeURIComponent(texte || '');
  return numero ? `https://wa.me/${numero}?text=${message}` : `https://wa.me/?text=${message}`;
};

/* ---------- Textes ---------- */

export function texteRecap(atelier, client, commande, variante) {
  const prenom = (client.nom || '').split(' ')[0];
  const reste = Math.max(0, (commande.prixTotal || 0) - (commande.acompte || 0));
  const signature = [atelier.nom, atelier.telephone].filter(Boolean).join(' — ');

  if (variante === 'prete') {
    return [
      `Bonjour ${prenom}, votre ${commande.modeleNom} est prêt.`,
      reste > 0 && !commande.soldeRegle ? `Reste à régler : ${montant(reste)}.` : null,
      signature,
    ].filter(Boolean).join('\n');
  }
  if (variante === 'livree') {
    return [`Bonjour ${prenom}, voici votre reçu pour ${commande.modeleNom}.`, signature]
      .filter(Boolean).join('\n');
  }
  return [
    `Bonjour ${prenom}, voici le récapitulatif de votre commande.`,
    signature,
  ].filter(Boolean).join('\n');
}

export function texteModeles(atelier, client, modeles) {
  const prenom = (client?.nom || '').split(' ')[0];
  const lignes = modeles.map(
    (m) => `— ${m.nom}${m.prixIndicatif ? `, à partir de ${montant(m.prixIndicatif)}` : ''}`,
  );
  return [
    prenom ? `Bonjour ${prenom}, voici les modèles dont nous avons parlé.` : 'Voici quelques modèles.',
    ...lignes,
    [atelier.nom, atelier.telephone].filter(Boolean).join(' — '),
  ].filter(Boolean).join('\n');
}

/* ---------- Envoi ----------
   Deux chemins selon ce que le telephone sait faire.

   1. Partage natif avec fichiers : la feuille de partage s'ouvre,
      le couturier choisit WhatsApp, la photo est deja jointe.
   2. Sinon : l'image est enregistree sur l'appareil et WhatsApp
      s'ouvre sur le bon numero avec le texte pret. Le couturier
      joint l'image lui-meme.

   La fonction rend ce qui s'est passe pour que l'appelant sache
   quoi afficher. */

export async function partager({ fichiers = [], texte = '', telephone = '', indicatif = '', titre = '' }) {
  const peutPartagerFichiers =
    fichiers.length > 0 &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: fichiers });

  if (peutPartagerFichiers) {
    try {
      await navigator.share({ files: fichiers, text: texte, title: titre });
      return { voie: 'partage' };
    } catch (erreur) {
      /* L'utilisateur a ferme la feuille de partage : ce n'est pas
         une erreur, et il ne faut surtout pas enchainer sur un
         second envoi qu'il n'a pas demande. */
      if (erreur?.name === 'AbortError') return { voie: 'annule' };
    }
  }

  for (const fichier of fichiers) enregistrer(fichier);
  window.open(lienWhatsApp(telephone, texte, indicatif), '_blank', 'noopener');
  return { voie: fichiers.length ? 'telechargement' : 'lien' };
}

export function enregistrer(fichier) {
  const url = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = fichier.name || 'dress-code';
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const nommer = (blob, nom) =>
  new File([blob], nom, { type: blob.type, lastModified: Date.now() });

export const nomFichier = (client, commande, extension) => {
  const propre = (texte) =>
    (texte || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  return `${[propre(client.nom), propre(commande.modeleNom)].filter(Boolean).join('-') || 'commande'}.${extension}`;
};
