/* ============================================================
   RECAPITULATIF — la fiche que la cliente recoit
   ------------------------------------------------------------
   C'est l'ajout qui separe le plus l'application du cahier : une
   trace ecrite, horodatee, envoyee le jour meme. Elle sert trois
   fois — a la commande, quand le vetement est pret, a la livraison
   comme recu — et circule ensuite de cliente en cliente avec le
   nom de l'atelier dessus.

   Image par defaut : elle s'affiche dans WhatsApp sans
   telechargement, sur n'importe quel telephone. Le PDF n'est la
   que pour les commandes ou la cliente veut un document propre.
   ============================================================ */

import { dateCourte, dateLongue, montant } from './metier.js';

const LARGEUR = 1080;
const MARGE = 72;

export const VARIANTES = {
  commande: { titre: 'Récapitulatif de commande', pied: 'Merci de votre confiance' },
  prete: { titre: 'Votre vêtement est prêt', pied: 'À récupérer à l’atelier' },
  livree: { titre: 'Reçu', pied: 'Soldé — merci' },
};

/* ---------- Couleurs ----------
   Lues dans la regle :root de la feuille de jetons, pas sur
   l'element courant : la fiche part chez la cliente, elle doit
   rester claire meme si le couturier travaille en mode sombre. */

let cacheCouleurs = null;

function couleurs() {
  if (cacheCouleurs) return cacheCouleurs;
  const trouvees = {};
  for (const feuille of document.styleSheets) {
    let regles;
    try {
      regles = feuille.cssRules;
    } catch {
      continue; /* feuille d'une autre origine */
    }
    for (const regle of regles) {
      if (regle.selectorText !== ':root') continue;
      for (const propriete of regle.style) {
        if (propriete.startsWith('--md-sys-color-')) {
          trouvees[propriete.replace('--md-sys-color-', '')] = regle.style.getPropertyValue(propriete).trim();
        }
      }
    }
  }
  cacheCouleurs = trouvees;
  return trouvees;
}

/* Le noir n'est pas un choix de charte : c'est le dernier recours
   si la feuille de jetons n'a pas pu etre lue (feuille d'une autre
   origine). Mieux vaut une fiche lisible qu'un texte invisible. */
const c = (role) => couleurs()[role] || '#000000';

/* ---------- Polices ----------
   Les polices doivent etre chargees avant le premier trace :
   un canvas dessine avec une police absente ne se redessine pas
   tout seul quand elle arrive. */

const MARQUE = '"Roboto Flex Variable", "Roboto Flex", sans-serif';
const COURANT = '"Roboto Variable", Roboto, sans-serif';

async function polices() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(`700 48px ${MARQUE}`),
    document.fonts.load(`500 32px ${COURANT}`),
    document.fonts.load(`400 32px ${COURANT}`),
  ]).catch(() => {});
}

/* ---------- Traces ---------- */

function rectangleArrondi(p, x, y, largeur, hauteur, rayon) {
  p.beginPath();
  p.moveTo(x + rayon, y);
  p.arcTo(x + largeur, y, x + largeur, y + hauteur, rayon);
  p.arcTo(x + largeur, y + hauteur, x, y + hauteur, rayon);
  p.arcTo(x, y + hauteur, x, y, rayon);
  p.arcTo(x, y, x + largeur, y, rayon);
  p.closePath();
}

/* Coupe un texte trop long pour la largeur donnee plutot que de le
   laisser deborder : un nom de modele bavard ne doit pas sortir de
   la fiche. */
function tronquer(p, texte, largeurMax) {
  if (p.measureText(texte).width <= largeurMax) return texte;
  let coupe = texte;
  while (coupe.length > 1 && p.measureText(`${coupe}…`).width > largeurMax) {
    coupe = coupe.slice(0, -1);
  }
  return `${coupe.trim()}…`;
}

function ligne(p, y, gauche, droite, { fort = false, couleur = null } = {}) {
  p.textBaseline = 'alphabetic';
  p.textAlign = 'left';
  p.font = `400 30px ${COURANT}`;
  p.fillStyle = c('on-surface-variant');
  p.fillText(gauche, MARGE, y);

  p.textAlign = 'right';
  p.font = `${fort ? 600 : 400} ${fort ? 36 : 30}px ${COURANT}`;
  p.fillStyle = couleur || c('on-surface');
  p.fillText(droite, LARGEUR - MARGE, y);
  return y;
}

/* ---------- Fiche ---------- */

export async function dessiner({ atelier, client, commande, photoUrl, variante = 'commande' }) {
  await polices();
  const forme = VARIANTES[variante] || VARIANTES.commande;
  const largeurUtile = LARGEUR - MARGE * 2;
  const reste = Math.max(0, (commande.prixTotal || 0) - (commande.acompte || 0));
  const solde = variante === 'livree' || commande.soldeRegle;

  /* Premiere passe : calculer la hauteur, pour que la fiche n'ait
     ni bande vide en bas ni contenu coupe. */
  const image = photoUrl ? await charger(photoUrl) : null;
  const hauteurPhoto = image ? Math.round(largeurUtile * 0.72) : 0;

  const hauteurEntete = 224;
  const hauteurLivraison = 148;
  const hauteurArgent = solde ? 150 : 236;
  const hauteurInfos = 3 * 62;
  const hauteur =
    hauteurEntete + (image ? hauteurPhoto + 48 : 24) + hauteurInfos + 40 +
    hauteurLivraison + 40 + hauteurArgent + 128;

  const toile = document.createElement('canvas');
  toile.width = LARGEUR;
  toile.height = hauteur;
  const p = toile.getContext('2d');

  p.fillStyle = c('surface');
  p.fillRect(0, 0, LARGEUR, hauteur);

  /* Entete : le nom et le numero de l'atelier. C'est ce qui fait
     circuler l'adresse quand la cliente montre sa fiche. */
  p.fillStyle = c('primary');
  p.fillRect(0, 0, LARGEUR, hauteurEntete);
  p.textAlign = 'center';
  p.fillStyle = c('on-primary');
  p.font = `700 52px ${MARQUE}`;
  p.fillText(tronquer(p, atelier.nom || 'Atelier', largeurUtile), LARGEUR / 2, 96);
  p.font = `400 28px ${COURANT}`;
  p.globalAlpha = 0.85;
  const coordonnees = [atelier.telephone, atelier.adresse].filter(Boolean).join('  ·  ');
  if (coordonnees) p.fillText(tronquer(p, coordonnees, largeurUtile), LARGEUR / 2, 142);
  p.font = `500 26px ${COURANT}`;
  p.fillText(forme.titre.toUpperCase(), LARGEUR / 2, 190);
  p.globalAlpha = 1;

  let y = hauteurEntete + 48;

  if (image) {
    p.save();
    rectangleArrondi(p, MARGE, y, largeurUtile, hauteurPhoto, 32);
    p.clip();
    dessinerCouvrant(p, image, MARGE, y, largeurUtile, hauteurPhoto);
    p.restore();
    y += hauteurPhoto + 60;
  } else {
    y += 24;
  }

  ligne(p, y, 'Cliente', tronquer(p, client.nom || '', largeurUtile * 0.62));
  y += 62;
  ligne(p, y, 'Modèle', tronquer(p, commande.modeleNom || '', largeurUtile * 0.62));
  y += 62;
  ligne(p, y, 'Commandé le', dateCourte(commande.dateCommande));
  y += 62;

  /* La date de livraison est la seule information que la cliente
     doit retenir : elle a sa propre bande. */
  y += 28;
  p.fillStyle = c('primary-container');
  rectangleArrondi(p, MARGE, y, largeurUtile, hauteurLivraison - 24, 28);
  p.fill();
  p.textAlign = 'left';
  p.fillStyle = c('on-primary-container');
  p.font = `500 26px ${COURANT}`;
  p.fillText('LIVRAISON', MARGE + 40, y + 50);
  p.font = `600 42px ${MARQUE}`;
  p.fillText(tronquer(p, dateLongue(commande.dateLivraison), largeurUtile - 80), MARGE + 40, y + 104);
  y += hauteurLivraison + 40;

  if (solde) {
    ligne(p, y, 'Montant réglé', montant(commande.prixTotal), { fort: true });
    y += 76;
  } else {
    ligne(p, y, 'Montant total', montant(commande.prixTotal));
    y += 62;
    ligne(p, y, 'Avance versée', montant(commande.acompte));
    y += 44;
    p.fillStyle = c('outline-variant');
    p.fillRect(MARGE, y, largeurUtile, 2);
    y += 58;
    ligne(p, y, 'Reste à payer', montant(reste), { fort: true, couleur: c('primary') });
    y += 76;
  }

  p.textAlign = 'center';
  p.fillStyle = c('on-surface-variant');
  p.font = `400 28px ${COURANT}`;
  p.fillText(forme.pied, LARGEUR / 2, hauteur - 56);

  return toile;
}

/* Remplit le cadre sans deformer la photo : une robe etiree
   n'inspire pas confiance. */
function dessinerCouvrant(p, image, x, y, largeur, hauteur) {
  const echelle = Math.max(largeur / image.width, hauteur / image.height);
  const l = image.width * echelle;
  const h = image.height * echelle;
  p.drawImage(image, x + (largeur - l) / 2, y + (hauteur - h) / 2, l, h);
}

const charger = (url) =>
  new Promise((resoudre, rejeter) => {
    const image = new Image();
    image.onload = () => resoudre(image);
    image.onerror = () => rejeter(new Error('Photo illisible'));
    image.src = url;
  });

export const versBlob = (toile, type = 'image/jpeg', qualite = 0.9) =>
  new Promise((resoudre) => toile.toBlob(resoudre, type, qualite));

/* ============================================================
   PDF — un fichier ecrit a la main
   ------------------------------------------------------------
   Une page, une image JPEG. Ecrire les quelques centaines d'octets
   de structure coute moins cher qu'embarquer une bibliotheque de
   300 Ko dans une application qui doit s'installer sur un forfait
   mobile compte.
   ============================================================ */

export async function versPdf(toile) {
  const jpeg = new Uint8Array(await (await versBlob(toile, 'image/jpeg', 0.9)).arrayBuffer());

  /* Page A4, image centree et mise a l'echelle pour tenir dedans. */
  const pageL = 595.28;
  const pageH = 841.89;
  const echelle = Math.min((pageL - 40) / toile.width, (pageH - 40) / toile.height);
  const l = toile.width * echelle;
  const h = toile.height * echelle;
  const x = (pageL - l) / 2;
  const y = (pageH - h) / 2;

  const contenu = `q\n${l.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`;

  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageL.toFixed(2)} ${pageH.toFixed(2)}] ` +
      '/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>',
    { flux: contenu, entete: `<< /Length ${contenu.length} >>` },
    {
      binaire: jpeg,
      entete:
        `<< /Type /XObject /Subtype /Image /Width ${toile.width} /Height ${toile.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,
    },
  ];

  const morceaux = [];
  const positions = [];
  let decalage = 0;
  const pousser = (donnees) => {
    const octets = typeof donnees === 'string' ? new TextEncoder().encode(donnees) : donnees;
    morceaux.push(octets);
    decalage += octets.length;
  };

  pousser('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  objets.forEach((objet, index) => {
    positions.push(decalage);
    const numero = index + 1;
    if (typeof objet === 'string') {
      pousser(`${numero} 0 obj\n${objet}\nendobj\n`);
      return;
    }
    pousser(`${numero} 0 obj\n${objet.entete}\nstream\n`);
    pousser(objet.binaire || objet.flux);
    pousser('\nendstream\nendobj\n');
  });

  const debutTable = decalage;
  let table = `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (const position of positions) {
    table += `${String(position).padStart(10, '0')} 00000 n \n`;
  }
  pousser(table);
  pousser(
    `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutTable}\n%%EOF\n`,
  );

  return new Blob(morceaux, { type: 'application/pdf' });
}
