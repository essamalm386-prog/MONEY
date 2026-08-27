/* ============================================================
   Verifications dans un vrai navigateur.
   node outils/verifier-navigateur.mjs [--captures]
   ------------------------------------------------------------
   outils/verifier.mjs couvre le moteur metier sans navigateur.
   Ici on verifie ce qui ne se voit qu'a l'execution : le parcours
   de commande, la fiche recapitulative, la sauvegarde, et la
   promesse la plus importante du produit — l'application demarre
   et reste utilisable sans reseau.

   Prerequis : npm install playwright
   ============================================================ */

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const captures = process.argv.includes('--captures');
const dossierCaptures = join(racine, 'captures');
const PORT = 8099;
const BASE = `http://localhost:${PORT}`;

/* L'environnement de developpement peut fournir un Chromium qui ne
   correspond pas a celui que Playwright telecharge. */
const preinstalle = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const lancement = existsSync(preinstalle) ? { executablePath: preinstalle } : {};

let passes = 0;
let total = 0;
const etape = async (nom, fn) => {
  total += 1;
  try {
    await fn();
    passes += 1;
    console.log(`OK    ${nom}`);
  } catch (erreur) {
    console.error(`ECHEC ${nom}\n      ${erreur.message.split('\n')[0]}`);
    process.exitCode = 1;
  }
};

const serveur = spawn(process.execPath, [join(racine, 'outils/servir.mjs'), String(PORT)], {
  stdio: 'ignore',
});
const arreter = () => serveur.kill();
process.on('exit', arreter);

await new Promise((r) => setTimeout(r, 700));
if (captures) mkdirSync(dossierCaptures, { recursive: true });

const navigateur = await chromium.launch(lancement);
const contexte = await navigateur.newContext({
  viewport: { width: 412, height: 900 },
  deviceScaleFactor: 2,
  locale: 'fr-FR',
});
const page = await contexte.newPage();

const incidents = [];
page.on('pageerror', (e) => incidents.push(`erreur de page : ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') incidents.push(`console : ${m.text()}`); });

const capturer = async (nom, pleinePage = true) => {
  if (captures) await page.screenshot({ path: join(dossierCaptures, `${nom}.png`), fullPage: pleinePage });
};

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

/* ---------- Parcours de creation ---------- */

await etape('renseigner la fiche atelier', async () => {
  await page.click('[data-atelier]');
  await page.waitForSelector('#a-nom');
  await page.fill('#a-nom', 'Atelier Kadi Couture');
  await page.fill('#a-tel', '77 123 45 67');
  await page.fill('#a-adresse', 'Médina, Dakar');
  await page.click('[data-identite]');
  await page.waitForTimeout(300);
});

await etape('creer une commande de bout en bout', async () => {
  await page.goto(`${BASE}/#/commande/nouvelle`);
  await page.waitForSelector('#nouveauNom');
  await page.fill('#nouveauNom', 'Fatou Sow');
  await page.fill('#nouveauTelephone', '77 123 45 67');
  for (const [champ, valeur] of [
    ['poitrine', '92'], ['taille', '74'], ['hanches', '100'],
    ['epaule', '38'], ['manche', '58'], ['longueur', '138'],
  ]) {
    await page.fill(`#mesure_${champ}`, valeur);
  }
  await page.fill('#modeleNom', 'Robe cérémonie');
  await page.locator('.raccourcis button', { hasText: 'Dans 3 jours' }).first().click();
  await page.waitForTimeout(250);
  await page.fill('#prixTotal', '50000');
  await page.fill('#acompte', '35000');
  await page.waitForTimeout(150);
  await capturer('nouvelle-commande');
});

await etape('le reste a payer se calcule pendant la saisie', async () => {
  const reste = await page.locator('[data-reste]').textContent();
  if (!reste.replace(/\s/g, ' ').includes('15 000')) throw new Error(`obtenu « ${reste} »`);
});

await etape('enregistrer mene a la fiche de la commande', async () => {
  await page.click('[data-enregistrer]');
  await page.waitForTimeout(700);
  if (!page.url().includes('#/commande/cmd_')) throw new Error(`url : ${page.url()}`);
  await capturer('fiche-commande');
});

/* ---------- Recapitulatif ---------- */

await etape('la fiche recapitulative se prepare toute seule', async () => {
  await page.click('[data-recap]');
  await page.waitForSelector('.apercu-recap', { timeout: 10000 });
  const alt = await page.locator('.apercu-recap').getAttribute('alt');
  if (!alt.includes('Fatou Sow')) throw new Error(`apercu : ${alt}`);
  if (captures) {
    await page.locator('.apercu-recap').screenshot({ path: join(dossierCaptures, 'recapitulatif.png') });
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
});

await etape('le PDF produit est structurellement valide', async () => {
  const octets = await page.evaluate(async () => {
    const [recap, donnees] = await Promise.all([
      import('./app/js/recap.js'), import('./app/js/donnees.js'),
    ]);
    const commande = (await donnees.lireTout('commandes'))[0];
    const toile = await recap.dessiner({
      atelier: await donnees.lireAtelier(),
      client: await donnees.lire('clients', commande.clientId),
      commande,
      photoUrl: await donnees.urlPhoto(commande.photoId),
    });
    return [...new Uint8Array(await (await recap.versPdf(toile)).arrayBuffer())];
  });
  const { Buffer } = await import('node:buffer');
  const tampon = Buffer.from(octets);
  const texte = tampon.toString('latin1');
  if (!texte.startsWith('%PDF-1.4')) throw new Error('en-tete absent');
  if (!texte.includes('/DCTDecode')) throw new Error('image absente');
  if (!texte.trimEnd().endsWith('%%EOF')) throw new Error('fin de fichier absente');
  /* Un lecteur de PDF se positionne par startxref : un decalage
     faux donne un fichier que rien n'ouvre. */
  const startxref = Number(texte.match(/startxref\n(\d+)/)[1]);
  if (texte.slice(startxref, startxref + 4) !== 'xref') {
    throw new Error(`table xref introuvable au decalage ${startxref}`);
  }
  if (captures) writeFileSync(join(dossierCaptures, 'recapitulatif.pdf'), tampon);
});

/* ---------- Avancement des statuts ---------- */

await etape('faire avancer une commande jusqu a la livraison', async () => {
  const url = page.url();
  await page.click('[data-avancer]');            // -> En confection
  await page.waitForTimeout(500);

  await page.click('[data-avancer]');            // -> Prete, ouvre la feuille
  await page.waitForSelector('.apercu-recap', { timeout: 10000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  /* Le statut a change meme sans envoi : l'ecran doit le montrer. */
  const apresPrete = await page.locator('#colonne').innerText();
  if (!apresPrete.includes('Marquer livrée')) {
    throw new Error('l ecran est reste sur l etape precedente apres fermeture de la feuille');
  }

  await page.click('[data-avancer]');            // -> Livree, demande le solde
  await page.waitForSelector('dialog.md-dialog', { timeout: 5000 });
  const titre = await page.locator('.md-dialog-title').textContent();
  if (!titre.includes('solde')) throw new Error(`dialogue inattendu : ${titre}`);
  await page.locator('.md-dialog button[value="oui"]').click();
  await page.waitForTimeout(600);

  /* Une commande livree dont la photo n'est pas au catalogue
     propose de l'y ranger. */
  if (await page.locator('dialog.md-dialog').count()) {
    await page.locator('.md-dialog button[value="non"]').click();
    await page.waitForTimeout(400);
  }

  await page.goto(url);
  await page.waitForTimeout(500);
  const fiche = await page.locator('#colonne').innerText();
  if (!fiche.includes('Livrée le')) throw new Error(`fiche : ${fiche.slice(0, 140)}`);
  if (!fiche.includes('Soldé')) throw new Error('le solde regle n a pas ete enregistre');
});

/* ---------- Recherche et catalogue ---------- */

await etape('la recherche trouve par les quatre derniers chiffres', async () => {
  await page.goto(`${BASE}/#/clients`);
  await page.waitForSelector('#recherche-clients');
  await page.fill('#recherche-clients', '4567');
  await page.waitForTimeout(200);
  const texte = await page.locator('[data-liste]').innerText();
  if (!texte.includes('Fatou Sow')) throw new Error(`resultat : ${texte.slice(0, 80)}`);
});

await etape('le bouton flottant du catalogue ajoute un modele', async () => {
  await page.goto(`${BASE}/#/modeles`);
  await page.waitForTimeout(400);
  if ((await page.locator('.fab-libelle').textContent()) !== 'Modèle') {
    throw new Error('le bouton flottant porte encore l action de commande');
  }
  await page.click('#fab');
  await page.waitForSelector('.feuille-entete h2');
  if ((await page.locator('.feuille-entete h2').textContent()) !== 'Nouveau modèle') {
    throw new Error('la feuille ouverte n est pas celle du modele');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
});

/* ---------- Sauvegarde ----------
   « Le jour ou un couturier perd cinq ans de mesures, il ne revient
   pas au numerique. » Un export qui ne se relit pas est pire que
   pas de sauvegarde du tout. */

await etape('une sauvegarde exportee se relit a l identique', async () => {
  const bilan = await page.evaluate(async () => {
    const d = await import('./app/js/donnees.js');
    const avant = {
      clients: (await d.lireTout('clients')).length,
      commandes: (await d.lireTout('commandes')).length,
      atelier: (await d.lireAtelier()).nom,
      mesures: (await d.lireTout('clients'))[0].mesures,
    };
    /* Aller-retour complet par le fichier, texte compris. */
    const fichier = JSON.stringify(await d.exporterSauvegarde());
    await d.importerSauvegarde(JSON.parse(fichier));
    const apres = {
      clients: (await d.lireTout('clients')).length,
      commandes: (await d.lireTout('commandes')).length,
      atelier: (await d.lireAtelier()).nom,
      mesures: (await d.lireTout('clients'))[0].mesures,
      photos: (await d.lireTout('photos')).length,
      taille: fichier.length,
    };
    return { avant, apres };
  });
  const { avant, apres } = bilan;
  if (avant.clients !== apres.clients || avant.commandes !== apres.commandes) {
    throw new Error(`avant ${JSON.stringify(avant)} / apres ${JSON.stringify(apres)}`);
  }
  if (avant.atelier !== apres.atelier) throw new Error('la fiche atelier ne survit pas');
  if (JSON.stringify(avant.mesures) !== JSON.stringify(apres.mesures)) {
    throw new Error('les mesures ne survivent pas');
  }
});

/* ---------- Mode sombre ---------- */

await etape('le mode sombre tient sur les ecrans principaux', async () => {
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const route of ['/', '/commandes', '/clients', '/modeles', '/atelier']) {
    await page.goto(`${BASE}/#${route}`);
    await page.waitForTimeout(350);
    const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    /* Un fond clair en mode sombre signale une couleur ecrite en
       dur quelque part. */
    const [r, v, b] = fond.match(/\d+/g).map(Number);
    if ((r + v + b) / 3 > 90) throw new Error(`${route} garde un fond clair : ${fond}`);
    await capturer(`sombre${route === '/' ? '-aujourdhui' : route.replace('/', '-')}`);
  }
  await page.emulateMedia({ colorScheme: 'light' });
});

/* ---------- Hors ligne ----------
   La verification la plus importante : le fonctionnement hors
   ligne n'est pas une option technique, c'est un argument de
   vente affiche des le premier ecran. */

await etape('le service worker met toute la coquille en cache', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, { timeout: 20000 });
  const entrees = await page.evaluate(async () => {
    const noms = await caches.keys();
    return (await (await caches.open(noms[0])).keys()).length;
  });
  if (entrees < 30) throw new Error(`${entrees} fichiers seulement en cache`);
});

await contexte.setOffline(true);

await etape('l application redemarre sans reseau', async () => {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.bloc, .journee-calme, .etat-vide', { timeout: 20000 });
  const texte = await page.locator('#colonne').innerText();
  if (!texte.includes('Aujourd’hui')) throw new Error('rien ne s est rendu');
  await capturer('hors-ligne');
});

await etape('les polices de la charte sont servies hors ligne', async () => {
  const police = await page.evaluate(() =>
    getComputedStyle(document.querySelector('.md-appbar-title')).fontFamily);
  if (!police.includes('Roboto Flex')) throw new Error(police);
});

await etape('on enregistre une commande sans reseau', async () => {
  await page.goto(`${BASE}/#/commande/nouvelle`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#nouveauNom', { timeout: 15000 });
  await page.fill('#nouveauNom', 'Coumba Fall');
  await page.fill('#modeleNom', 'Tailleur');
  await page.locator('.raccourcis button', { hasText: 'Demain' }).first().click();
  await page.waitForTimeout(250);
  await page.fill('#prixTotal', '40000');
  await page.click('[data-enregistrer]');
  await page.waitForTimeout(800);
  if (!page.url().includes('#/commande/cmd_')) throw new Error(`url : ${page.url()}`);
});

await etape('la fiche recapitulative se genere sans reseau', async () => {
  await page.click('[data-recap]');
  await page.waitForSelector('.apercu-recap', { timeout: 15000 });
  await page.keyboard.press('Escape');
});

await contexte.setOffline(false);
await navigateur.close();
arreter();

if (incidents.length) {
  console.error(`\n${incidents.length} incident(s) dans la console :`);
  for (const incident of incidents) console.error(`  ${incident}`);
  process.exitCode = 1;
}
console.log(`\n${passes}/${total} verifications passees${captures ? ` — captures dans captures/` : ''}`);
