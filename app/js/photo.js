/* ============================================================
   PHOTO — capture et reduction
   ------------------------------------------------------------
   Une photo de telephone pese 3 a 8 Mo. Stockees telles quelles,
   trente modeles saturent le stockage de l'appareil et chaque
   ouverture de liste rame. On redimensionne avant d'enregistrer :
   1 280 px suffisent pour montrer un modele a une cliente et pour
   le recapitulatif WhatsApp.
   ============================================================ */

const COTE_MAX = 1280;
const QUALITE = 0.82;

export function choisirPhoto({ camera = false } = {}) {
  return new Promise((resoudre) => {
    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = 'image/*';
    /* « capture » ouvre l'appareil photo directement ; sans lui, le
       telephone propose la galerie — c'est le cas quand la cliente
       vient de montrer une photo sur son propre telephone. */
    if (camera) champ.capture = 'environment';
    champ.addEventListener('change', () => resoudre(champ.files?.[0] || null), { once: true });
    champ.addEventListener('cancel', () => resoudre(null), { once: true });
    champ.click();
  });
}

export async function reduire(fichier) {
  if (!fichier) return null;
  const image = await charger(fichier);
  const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * echelle);
  const hauteur = Math.round(image.height * echelle);

  const toile = document.createElement('canvas');
  toile.width = largeur;
  toile.height = hauteur;
  const pinceau = toile.getContext('2d');
  pinceau.imageSmoothingQuality = 'high';
  pinceau.drawImage(image, 0, 0, largeur, hauteur);
  image.close?.();

  return new Promise((resoudre) => toile.toBlob(resoudre, 'image/jpeg', QUALITE));
}

async function charger(fichier) {
  /* createImageBitmap applique l'orientation EXIF : sans cela, une
     photo prise en portrait arrive couchee dans le recapitulatif. */
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(fichier, { imageOrientation: 'from-image' });
    } catch { /* navigateur ancien : on retombe sur Image */ }
  }
  return new Promise((resoudre, rejeter) => {
    const image = new Image();
    const url = URL.createObjectURL(fichier);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resoudre(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      rejeter(new Error('Image illisible'));
    };
    image.src = url;
  });
}

/* Chaine complete : ouvrir, reduire, enregistrer, rendre l'identifiant. */
export async function capturer(ajouterPhoto, options) {
  const fichier = await choisirPhoto(options);
  if (!fichier) return null;
  const reduite = await reduire(fichier);
  if (!reduite) return null;
  return ajouterPhoto(reduite);
}
