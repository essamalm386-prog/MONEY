/* ============================================================
   DONNEES — stockage local, hors ligne d'abord
   ------------------------------------------------------------
   Tout vit dans IndexedDB, sur le telephone. Aucun compte,
   aucun serveur : l'application doit fonctionner dans un atelier
   sans reseau, et c'est aussi ce qui garantit qu'aucune mesure
   de cliente ne quitte l'appareil.

   Les photos sont stockees en Blob dans leur propre magasin :
   les garder dans les commandes ferait grossir chaque lecture
   de liste de plusieurs megaoctets.
   ============================================================ */

const NOM_BASE = 'dress-code';
const VERSION = 1;

const MAGASINS = {
  atelier: { keyPath: 'cle' },
  clients: { keyPath: 'id', index: { nom: 'nom', telephone: 'telephone' } },
  modeles: { keyPath: 'id', index: { categorie: 'categorie' } },
  commandes: { keyPath: 'id', index: { clientId: 'clientId', statut: 'statut', dateLivraison: 'dateLivraison' } },
  photos: { keyPath: 'id' },
  envois: { keyPath: 'id', index: { clientId: 'clientId' } },
};

let basePromesse = null;

function ouvrir() {
  if (basePromesse) return basePromesse;
  basePromesse = new Promise((resoudre, rejeter) => {
    const requete = indexedDB.open(NOM_BASE, VERSION);
    requete.onupgradeneeded = () => {
      const base = requete.result;
      for (const [nom, schema] of Object.entries(MAGASINS)) {
        if (base.objectStoreNames.contains(nom)) continue;
        const magasin = base.createObjectStore(nom, { keyPath: schema.keyPath });
        for (const [cle, chemin] of Object.entries(schema.index || {})) {
          magasin.createIndex(cle, chemin, { unique: false });
        }
      }
    };
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });
  return basePromesse;
}

function transaction(magasins, mode, travail) {
  return ouvrir().then(
    (base) =>
      new Promise((resoudre, rejeter) => {
        const tx = base.transaction(magasins, mode);
        let resultat;
        tx.oncomplete = () => resoudre(resultat);
        tx.onerror = () => rejeter(tx.error);
        tx.onabort = () => rejeter(tx.error);
        Promise.resolve(travail(...magasins.map((m) => tx.objectStore(m))))
          .then((valeur) => {
            resultat = valeur;
          })
          .catch((erreur) => {
            rejeter(erreur);
            tx.abort();
          });
      }),
  );
}

const promesse = (requete) =>
  new Promise((resoudre, rejeter) => {
    requete.onsuccess = () => resoudre(requete.result);
    requete.onerror = () => rejeter(requete.error);
  });

/* Identifiant trie dans le temps : le prefixe horodate rend l'ordre
   d'insertion lisible sans champ supplementaire, le suffixe aleatoire
   evite la collision quand deux enregistrements tombent sur la meme
   milliseconde. */
export function nouvelId(prefixe) {
  const temps = Date.now().toString(36);
  const hasard = Math.random().toString(36).slice(2, 8);
  return `${prefixe}_${temps}${hasard}`;
}

export const lire = (magasin, id) => transaction([magasin], 'readonly', (m) => promesse(m.get(id)));
export const lireTout = (magasin) => transaction([magasin], 'readonly', (m) => promesse(m.getAll()));

export const ecrire = (magasin, enregistrement) =>
  transaction([magasin], 'readwrite', (m) => promesse(m.put(enregistrement))).then(() => enregistrement);

export const supprimer = (magasin, id) => transaction([magasin], 'readwrite', (m) => promesse(m.delete(id)));

export const lireParIndex = (magasin, index, valeur) =>
  transaction([magasin], 'readonly', (m) => promesse(m.index(index).getAll(valeur)));

/* ---------- Atelier ----------
   Une seule fiche, remplie au premier lancement et reutilisee
   sur tous les recapitulatifs. */

export const ATELIER_VIDE = {
  cle: 'atelier',
  nom: '',
  telephone: '',
  adresse: '',
  logoId: null,
  cadenceParDefaut: 'normale',
  themeChoisi: null,
  dernierResume: null,
};

export async function lireAtelier() {
  const enregistre = await lire('atelier', 'atelier');
  return { ...ATELIER_VIDE, ...(enregistre || {}) };
}

export const ecrireAtelier = (atelier) => ecrire('atelier', { ...atelier, cle: 'atelier' });

/* ---------- Photos ----------
   Rendues sous forme d'URL d'objet. Les URL sont mises en cache et
   revoquees ensemble : les creer a chaque rendu de liste fuiterait
   la memoire a chaque defilement. */

const urlsPhotos = new Map();

export async function ajouterPhoto(blob) {
  const id = nouvelId('img');
  await ecrire('photos', { id, blob, creeLe: Date.now() });
  return id;
}

export async function urlPhoto(id) {
  if (!id) return null;
  if (urlsPhotos.has(id)) return urlsPhotos.get(id);
  const enregistrement = await lire('photos', id);
  if (!enregistrement) return null;
  const url = URL.createObjectURL(enregistrement.blob);
  urlsPhotos.set(id, url);
  return url;
}

export async function blobPhoto(id) {
  if (!id) return null;
  const enregistrement = await lire('photos', id);
  return enregistrement ? enregistrement.blob : null;
}

export async function supprimerPhoto(id) {
  if (!id) return;
  const url = urlsPhotos.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlsPhotos.delete(id);
  }
  await supprimer('photos', id);
}

/* ---------- Sauvegarde ----------
   « Le jour ou un couturier perd cinq ans de mesures, il ne revient
   pas au numerique. » L'export embarque les photos en base64 : un
   fichier unique, qui se range dans WhatsApp ou dans un mail. */

const enBase64 = (blob) =>
  new Promise((resoudre) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(lecteur.result);
    lecteur.readAsDataURL(blob);
  });

const depuisBase64 = (donnees) => fetch(donnees).then((r) => r.blob());

export async function exporterSauvegarde() {
  const [atelier, clients, modeles, commandes, envois, photos] = await Promise.all([
    lireAtelier(),
    lireTout('clients'),
    lireTout('modeles'),
    lireTout('commandes'),
    lireTout('envois'),
    lireTout('photos'),
  ]);
  const photosEncodees = [];
  for (const photo of photos) {
    photosEncodees.push({ id: photo.id, creeLe: photo.creeLe, donnees: await enBase64(photo.blob) });
  }
  return {
    format: 'dress-code-sauvegarde',
    version: 1,
    creeLe: new Date().toISOString(),
    atelier,
    clients,
    modeles,
    commandes,
    envois,
    photos: photosEncodees,
  };
}

export async function importerSauvegarde(sauvegarde) {
  if (!sauvegarde || sauvegarde.format !== 'dress-code-sauvegarde') {
    throw new Error('Fichier non reconnu');
  }
  const photos = [];
  for (const photo of sauvegarde.photos || []) {
    photos.push({ id: photo.id, creeLe: photo.creeLe, blob: await depuisBase64(photo.donnees) });
  }
  await transaction(
    ['atelier', 'clients', 'modeles', 'commandes', 'envois', 'photos'],
    'readwrite',
    (atelier, clients, modeles, commandes, envois, magasinPhotos) => {
      [atelier, clients, modeles, commandes, envois, magasinPhotos].forEach((m) => m.clear());
      atelier.put({ ...ATELIER_VIDE, ...sauvegarde.atelier, cle: 'atelier' });
      (sauvegarde.clients || []).forEach((c) => clients.put(c));
      (sauvegarde.modeles || []).forEach((m) => modeles.put(m));
      (sauvegarde.commandes || []).forEach((c) => commandes.put(c));
      (sauvegarde.envois || []).forEach((e) => envois.put(e));
      photos.forEach((p) => magasinPhotos.put(p));
    },
  );
  urlsPhotos.forEach((url) => URL.revokeObjectURL(url));
  urlsPhotos.clear();
  return {
    clients: (sauvegarde.clients || []).length,
    commandes: (sauvegarde.commandes || []).length,
    modeles: (sauvegarde.modeles || []).length,
  };
}
