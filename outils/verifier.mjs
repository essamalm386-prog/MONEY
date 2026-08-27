/* Verifications du moteur metier — node outils/verifier.mjs
   Ce sont les regles que l'utilisateur ne verifie jamais lui-meme :
   une commande classee « calme » alors qu'elle est en retard ne se
   voit pas a l'ecran, elle se voit quand la cliente rappelle. */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CADENCES, STATUTS, correspond, dateLongue, delai, etat, joursEntre,
  mesuresAnciennes, montant, normaliser, reste, resumeDuJour, texteResume, versISO,
} from '../app/js/metier.js';

let passes = 0;
const cas = [];
const test = (nom, fn) => cas.push([nom, fn]);

/* Date de reference : les tests fabriquent leurs echeances par
   decalage, pour ne pas expirer le lendemain de leur ecriture. */
const dans = (jours) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + jours);
  return versISO(d);
};

const commande = (extras = {}) => ({
  id: 'cmd_1',
  statut: 'a_commencer',
  cadence: 'normale',
  dateLivraison: dans(5),
  prixTotal: 50000,
  acompte: 35000,
  soldeRegle: false,
  ...extras,
});

test('un montant se lit avec un separateur de milliers insecable', () => {
  assert.equal(montant(85000), '85 000 F');
  assert.equal(montant(0), '0 F');
  assert.equal(montant(1250000), '1 250 000 F');
});

test('le reste a payer se deduit du total et de l\'acompte', () => {
  assert.equal(reste(commande()), 15000);
  assert.equal(reste(commande({ soldeRegle: true })), 0);
  assert.equal(reste(commande({ acompte: 60000 })), 0, 'un acompte superieur au total ne rend pas un reste negatif');
});

test('une livraison depassee passe en retard, jamais avant', () => {
  assert.equal(etat(commande({ dateLivraison: dans(1) })).enRetard, false);
  assert.equal(etat(commande({ dateLivraison: dans(0) })).enRetard, false, "le jour meme n'est pas un retard");
  assert.equal(etat(commande({ dateLivraison: dans(-1) })).enRetard, true);
  assert.equal(
    etat(commande({ dateLivraison: dans(-3), statut: 'livree' })).enRetard,
    false,
    'une commande livree ne peut plus etre en retard',
  );
});

test("la cadence decide seule du moment ou l'application dit de commencer", () => {
  const jours = 4;
  assert.equal(etat(commande({ cadence: 'rapide', dateLivraison: dans(jours) })).aCommencer, false);
  assert.equal(etat(commande({ cadence: 'normale', dateLivraison: dans(jours) })).aCommencer, false);
  assert.equal(etat(commande({ cadence: 'longue', dateLivraison: dans(jours) })).aCommencer, true);
  assert.equal(etat(commande({ cadence: 'rapide', dateLivraison: dans(1) })).aCommencer, true);
});

test('une commande deja commencee ne redemande pas a etre commencee', () => {
  assert.equal(etat(commande({ statut: 'en_confection', dateLivraison: dans(1) })).aCommencer, false);
});

test('une commande apparait dans un seul bloc du resume', () => {
  const resume = resumeDuJour([
    commande({ id: 'a', dateLivraison: dans(-2) }),
    commande({ id: 'b', dateLivraison: dans(0) }),
    commande({ id: 'c', dateLivraison: dans(1) }),
    commande({ id: 'd', statut: 'en_confection', dateLivraison: dans(4) }),
    commande({ id: 'e', statut: 'livree', soldeRegle: true, dateLivraison: dans(-9) }),
  ]);
  const place = [
    ...resume.retard, ...resume.aCommencer, ...resume.enConfection,
    ...resume.pretes, ...resume.livraisons,
  ].map((x) => x.commande.id);
  assert.deepEqual([...new Set(place)].sort(), place.sort(), 'une commande comptee deux fois fausse la lecture');
  assert.deepEqual(resume.retard.map((x) => x.commande.id), ['a']);
  assert.deepEqual(resume.livraisons.map((x) => x.commande.id), ['b']);
  assert.deepEqual(resume.aCommencer.map((x) => x.commande.id), ['c']);
});

test('les retards remontent en tete, du plus ancien au plus recent', () => {
  const resume = resumeDuJour([
    commande({ id: 'un_jour', dateLivraison: dans(-1) }),
    commande({ id: 'cinq_jours', dateLivraison: dans(-5) }),
  ]);
  assert.deepEqual(resume.retard.map((x) => x.commande.id), ['cinq_jours', 'un_jour']);
});

test('le total a encaisser suit les commandes livrees mais non soldees', () => {
  const resume = resumeDuJour([
    commande({ id: 'a' }),
    commande({ id: 'b', statut: 'livree', dateLivraison: dans(-4), prixTotal: 45000, acompte: 20000 }),
    commande({ id: 'c', statut: 'livree', soldeRegle: true }),
  ]);
  assert.equal(resume.aEncaisser, 40000, 'un solde non regle reste du apres la livraison');
  assert.equal(resume.nbImpayees, 2);
});

test('une journee sans rien a faire se declare calme', () => {
  const resume = resumeDuJour([commande({ statut: 'en_confection', cadence: 'rapide', dateLivraison: dans(9) })]);
  assert.equal(resume.calme, true);
  assert.equal(texteResume(resume), null, 'rien a dire ne declenche aucune notification');
});

test('le resume du matin annonce le retard avant le reste', () => {
  const resume = resumeDuJour([
    commande({ id: 'a', dateLivraison: dans(-2) }),
    commande({ id: 'b', dateLivraison: dans(0) }),
  ]);
  assert.equal(texteResume(resume), '1 commande en retard, 1 à livrer');
});

test('la recherche client accepte le nom accentue et les quatre derniers chiffres', () => {
  const client = { nom: 'Aminata Kébé', telephone: '77 123 45 67' };
  assert.equal(correspond(client, 'kebe'), true);
  assert.equal(correspond(client, 'KÉBÉ'), true);
  assert.equal(correspond(client, '4567'), true);
  assert.equal(correspond(client, '  '), true, 'une recherche vide ne filtre rien');
  assert.equal(correspond(client, 'traore'), false);
  assert.equal(correspond(client, '9'), false, 'un seul chiffre est trop court pour filtrer un numero');
});

test('des mesures de plus de six mois sont signalees comme a reprendre', () => {
  const ilYA = (jours) => Date.now() - jours * 86400000;
  assert.equal(mesuresAnciennes(ilYA(30)), false);
  assert.equal(mesuresAnciennes(ilYA(200)), true);
  assert.equal(mesuresAnciennes(null), true, 'aucune mesure connue vaut mesures a prendre');
});

test('les dates se disent en francais et en delai', () => {
  assert.equal(dateLongue('2026-08-26'), 'mercredi 26 août');
  assert.equal(delai(dans(0)), 'aujourd’hui');
  assert.equal(delai(dans(1)), 'demain');
  assert.equal(delai(dans(3)), 'dans 3 jours');
  assert.equal(delai(dans(-1)), '1 jour de retard', 'dans une liste, « hier » ne dit pas le retard');
  assert.equal(delai(dans(-2)), '2 jours de retard');
});

test('un changement de fuseau ne decale pas le comptage des jours', () => {
  assert.equal(joursEntre(new Date(2026, 2, 28, 23, 30), new Date(2026, 2, 30, 0, 30)), 2);
});

test('chaque statut sait lequel le suit, et le dernier ne suit rien', () => {
  assert.equal(STATUTS.a_commencer.suivant, 'en_confection');
  assert.equal(STATUTS.prete.suivant, 'livree');
  assert.equal(STATUTS.livree.suivant, null);
  Object.values(CADENCES).forEach((c) => assert.ok(c.anticipation >= 1));
});

/* ---------- Coherence du projet ----------
   Ces verifications ne portent pas sur une regle metier mais sur
   des erreurs qui ne se voient qu'a l'usage : une icone absente du
   sous-ensemble s'affiche en carre vide, un fichier oublie dans la
   coquille donne un ecran blanc dans un atelier sans reseau. */

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (chemin) => readFileSync(join(racine, chemin), 'utf8');

const fichiersJs = (dossier) =>
  readdirSync(join(racine, dossier), { withFileTypes: true }).flatMap((entree) =>
    entree.isDirectory()
      ? fichiersJs(join(dossier, entree.name))
      : entree.name.endsWith('.js')
        ? [join(dossier, entree.name)]
        : [],
  );

test('chaque icone appelee existe dans le sous-ensemble embarque', () => {
  const table = lire('design/icones/icones.js');
  const connues = new Set([...table.matchAll(/^ {2}([a-z_0-9]+):/gm)].map((m) => m[1]));
  const appelees = new Set();
  for (const fichier of fichiersJs('app/js')) {
    for (const appel of lire(fichier).matchAll(/\bicone\(\s*'([a-z_0-9]+)'/g)) {
      appelees.add(appel[1]);
    }
  }
  assert.ok(appelees.size > 20, 'la detection des appels d\'icone ne trouve presque rien');
  const absentes = [...appelees].filter((nom) => !connues.has(nom));
  assert.deepEqual(absentes, [], 'a lister dans outils/icones-utilisees.txt puis relancer le sous-ensemblage');
});

test('la coquille du service worker ne reference que des fichiers presents', () => {
  const coquille = [...lire('sw.js').matchAll(/^ {2}'(\.\/[^']+)',$/gm)].map((m) => m[1]);
  assert.ok(coquille.length > 25, 'la liste de coquille semble tronquee');
  const manquants = coquille
    .filter((chemin) => chemin !== './')
    .filter((chemin) => !existsSync(join(racine, chemin)));
  assert.deepEqual(manquants, [], 'un fichier absent du disque donne un ecran blanc hors ligne');
});

test('tout module de l\'application figure dans la coquille', () => {
  const coquille = lire('sw.js');
  const oublies = fichiersJs('app/js')
    .map((chemin) => `./${chemin.split(/[\\/]/).join('/')}`)
    .filter((chemin) => !coquille.includes(`'${chemin}'`));
  assert.deepEqual(oublies, [], 'a ajouter dans la liste COQUILLE de sw.js');
});

test('aucune couleur codee en dur dans la feuille de styles', () => {
  const css = lire('app/app.css');
  const dures = [...css.matchAll(/#[0-9a-fA-F]{3,8}\b|\brgba?\(/g)].map((m) => m[0]);
  assert.deepEqual(dures, [], 'utiliser var(--md-sys-color-*) : sinon le mode sombre casse');
});

test('les fichiers charges par index.html existent', () => {
  const html = lire('index.html');
  const references = [...html.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1]);
  const manquants = references.filter((chemin) => !existsSync(join(racine, chemin)));
  assert.deepEqual(manquants, []);
});

test('les polices declarees sont bien embarquees', () => {
  const css = lire('design/polices/polices.css');
  const urls = [...css.matchAll(/url\('\.\/([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 2);
  const manquants = urls.filter((chemin) => !existsSync(join(racine, 'design/polices', chemin)));
  assert.deepEqual(manquants, []);
});

for (const [nom, fn] of cas) {
  try {
    fn();
    passes += 1;
  } catch (erreur) {
    console.error(`ECHEC — ${nom}\n  ${erreur.message}`);
    process.exitCode = 1;
  }
}
console.log(`${passes}/${cas.length} verifications passees`);
