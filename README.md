# DRESS CODE By Essama

**Le cahier du couturier, qui se souvient à sa place.**

Une application qui reprend le cahier du couturier — clientes, mesures, modèles,
commandes, paiements — et qui, en plus, affiche la journée à l'ouverture, prévient
avant qu'une livraison ne soit oubliée, et envoie les modèles et les récapitulatifs
de commande aux clientes par WhatsApp en un appui.

Elle fonctionne sans compte, sans connexion, et sans qu'aucune donnée ne quitte
le téléphone.

---

## Démarrer

L'application est faite de fichiers statiques : aucune compilation, aucun paquet
à installer pour la faire tourner.

```bash
node outils/servir.mjs        # http://localhost:8080
```

Pour la mettre en ligne, il suffit de publier le dossier tel quel sur n'importe
quel hébergement statique. Le service worker exige HTTPS (ou `localhost`) ;
sans lui, l'application marche encore, mais sans mise en cache hors ligne.

Sur téléphone, « Ajouter à l'écran d'accueil » l'installe comme une application.

---

## Les écrans

| Écran | Ce qu'on y fait |
|---|---|
| **Aujourd'hui** | Voir sa journée : retards, livraisons du jour, vêtements à commencer, reste à encaisser |
| **Commandes** | La liste, filtrée par urgence ou par statut ; faire avancer une commande |
| **Clientes** | Retrouver une cliente par son nom ou les quatre derniers chiffres de son numéro |
| **Modèles** | Le catalogue de l'atelier ; l'envoyer à une cliente |
| **Atelier** | Identité, apparence, rappel du matin, sauvegarde |

### Le parcours principal

```
Cliente → Mesures → Modèle → Date de livraison → Prix → Récapitulatif WhatsApp
```

La création d'une commande tient sur un seul écran qui défile, sans étape à
valider : le vrai concurrent n'est pas une autre application, c'est un stylo.
Ce qui est déjà connu est pré-rempli — les mesures d'une cliente existante, le
prix du modèle choisi au catalogue, la date du jour.

### Les rappels

Le couturier ne saisit **qu'une seule date**, celle promise à la cliente.
L'application en déduit le reste, selon le temps de confection choisi à la
commande :

| Temps de confection | Prévient de commencer |
|---|---|
| Rapide (ourlet, retouche) | 1 jour avant |
| Normale (robe, chemise) | 3 jours avant |
| Longue (costume, mariage) | 6 jours avant |

**Une notification par jour au maximum**, et rien du tout quand il n'y a rien à
dire. Sans serveur, le résumé part à la première ouverture de la journée plutôt
qu'à une heure fixe : c'est le prix d'une application qui n'envoie aucune donnée
nulle part.

### L'envoi WhatsApp

L'application prépare l'image et le texte, puis ouvre WhatsApp sur le numéro de
la cliente. **C'est le couturier qui appuie sur « envoyer ».**

Ce n'est pas de la prudence de principe : WhatsApp suspend les numéros qui
envoient en masse sans sollicitation, et un couturier dont le numéro
professionnel est bloqué perd son carnet d'adresses du jour au lendemain. Il n'y
a donc ni sélection multiple de clientes, ni envoi programmé, ni campagne.

Le récapitulatif est une **image** par défaut — elle s'affiche dans WhatsApp sans
téléchargement, sur n'importe quel téléphone. Un PDF est proposé en second, pour
les commandes où la cliente veut un document à imprimer.

---

## Ce que l'application ne fait pas

Chacune de ces absences est un choix.

Pas de comptabilité, pas de gestion de stock de tissus, pas de facturation
officielle, pas de gestion d'équipe, pas de statistiques de chiffre d'affaires,
pas d'inscription obligatoire, **pas de boutique en ligne** (le catalogue sert à
montrer et à envoyer, jamais à commander en libre-service), **pas d'envoi groupé**.

Prises une par une, ces fonctions ont l'air utiles. Ensemble, elles transforment
le cahier en logiciel de gestion — et le couturier retourne à son cahier.

---

## Les données

Tout vit dans **IndexedDB**, sur l'appareil : aucun compte, aucun serveur, aucune
mesure de cliente qui sorte du téléphone.

Ce choix a une contrepartie qu'il faut dire : un cahier ne se perd presque jamais,
un téléphone se casse, se vole, se change. D'où l'export dans **Atelier →
Sauvegarde**, qui produit un fichier unique — photos comprises — à ranger dans
WhatsApp, un mail ou un stockage en ligne. La restauration relit ce fichier et
remplace tout.

| Magasin | Contenu |
|---|---|
| `atelier` | Nom, téléphone, adresse, indicatif, apparence |
| `clients` | Nom, téléphone, mesures et leur date de mise à jour |
| `modeles` | Nom, catégorie, prix indicatif, photo |
| `commandes` | Cliente, modèle, mesures figées, dates, statut, montants |
| `photos` | Les images, en Blob, à part des commandes |
| `envois` | Trace légère : « 3 modèles envoyés le 12/08 » |

---

## Le système de design

L'interface applique le **google-design-kit** (Material Design 3 Expressive)
fourni avec le projet. Les règles suivies sont dans
[`design/CHARTE-GRAPHIQUE.md`](design/CHARTE-GRAPHIQUE.md) et
[`design/REFERENTIEL-REDACTION.md`](design/REFERENTIEL-REDACTION.md) — ces deux
fichiers sont la référence, pas de la documentation d'accompagnement.

Aucune couleur, aucun espacement, aucun rayon n'est écrit en dur : tout passe par
les variables de `design/tokens/tokens.css`. Le mode sombre fonctionne donc sans
une ligne de CSS supplémentaire, et `outils/verifier.mjs` échoue si une valeur en
dur se glisse dans la feuille de styles.

**Couleur de marque : `#3f3d9e`**, un indigo profond. Les 29 rôles de couleur en
sont dérivés par l'algorithme HCT de Google.

### Ce qui a été allégé, et pourquoi

Le kit complet pèse une quarantaine de mégaoctets. Le produit vise des téléphones
d'entrée de gamme sur réseau mobile compté : charger 5,3 Mo d'icônes dont on
utilise 1,5 % contredit la promesse « ouvre et vois ta journée ».

| Élément | Kit | Embarqué |
|---|---|---|
| Icônes Material Symbols | 5,3 Mo (3 899 icônes) | 53 Ko (57 icônes) |
| Familles de polices | 5 | 2 — Roboto Flex pour les titres, Roboto pour le reste |
| **Total** | ~40 Mo | **880 Ko** |

Les quatre axes variables des icônes (`FILL`, `wght`, `GRAD`, `opsz`) sont
conservés : le mode sombre compense bien l'irradiation optique, et `opsz` suit la
taille de rendu comme l'exige la charte.

Les icônes s'adressent par leur point de code via `design/icones/icones.js` et non
par leur ligature : le sous-ensemblage élague les règles GSUB de la police, et une
ligature perdue afficherait le mot « straighten » à la place du glyphe.

---

## Structure

```
index.html                  Coquille : barre, écran, navigation
manifest.webmanifest        Installation sur l'écran d'accueil
sw.js                       Service worker — mise en cache de la coquille

app/
  app.css                   Styles propres au projet, uniquement des variables
  js/
    app.js                  Routes, barre du haut, navigation, démarrage
    routeur.js              Navigation par fragment d'URL
    donnees.js              IndexedDB, photos, export et import de sauvegarde
    metier.js               Statuts, rappels déduits, totaux, formats français
    interface.js            Briques de rendu : icône, feuille, dialogue, message
    photo.js                Capture et réduction des photos
    recap.js                Fiche récapitulative en canvas, et PDF sans dépendance
    partage.js              WhatsApp assisté, jamais automatisé
    rappels.js              Le résumé du matin, une fois par jour
    theme.js                Clair, sombre, système
    vues/                   Un fichier par écran

design/                     Le kit, réduit à ce que l'application utilise
outils/                     Génération des jetons, des icônes, et vérifications
```

---

## Vérifier

```bash
node outils/verifier.mjs              # moteur métier + cohérence du projet
npm install playwright                # une seule fois
node outils/verifier-navigateur.mjs   # parcours réels dans Chromium
```

`outils/verifier.mjs` couvre les règles qui ne se voient pas à l'écran : une
commande classée « calme » alors qu'elle est en retard ne se remarque que le jour
où la cliente rappelle. Il vérifie aussi qu'aucune icône appelée ne manque au
sous-ensemble, qu'aucun module n'est absent de la coquille du service worker, et
qu'aucune couleur n'est écrite en dur.

`outils/verifier-navigateur.mjs` pilote un vrai navigateur : création d'une
commande, génération du récapitulatif et du PDF, recherche cliente, aller-retour
complet d'une sauvegarde, mode sombre, et — la vérification la plus importante —
redémarrage et création d'une commande **réseau coupé**.

Ajouter `--captures` produit les captures d'écran dans `captures/`.

---

## Regénérer les ressources du kit

```bash
# Changer la couleur de marque : les 29 rôles sont recalculés
node outils/generer-tokens.mjs '#3f3d9e'

# Après avoir ajouté une icône dans outils/icones-utilisees.txt.
# La police source (5,2 Mo) n'est pas versionnée : passer le chemin
# de google-design-kit/icones/fonts/material-symbols-rounded.woff2
node outils/sous-ensembler-icones.mjs chemin/vers/material-symbols-rounded.woff2

# Icônes d'application, à partir de app/img/icone.svg
node outils/generer-icones-app.mjs
```

---

## Licences

Material Symbols, Roboto et `material-color-utilities` sont sous licence
Apache 2.0. Les fichiers de licence sont conservés dans `design/icones/` et dans
chaque dossier de police. Aucune attribution n'est requise dans l'interface.
