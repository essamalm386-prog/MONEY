# Pointage BTP

Outil de **pointage des heures** des intérimaires et employés **par chantier**, destiné aux **chefs de chantier** pour saisir chaque jour les heures travaillées par leur équipe. La hiérarchie dispose ainsi, **en temps réel**, des justificatifs (jour / semaine / mois) au lieu d'attendre les relevés papier.

L'application **fonctionne en local et en ligne** : saisie possible **hors-ligne** sur le chantier (stockage local), puis **synchronisation automatique** dès qu'une connexion est disponible.

## Fonctionnalités

- **Planning des équipes — tous les chantiers sur une seule page** : le
  conducteur de travaux / gérant voit **l'ensemble des chantiers** de la semaine,
  compose chaque équipe et **désigne le chef de chantier** (un seul par chantier
  et par période, choisi parmi les personnes affectées). Les chefs de chantier ne
  pointent que le **personnel affecté**.
  - Le planning s'ouvre par défaut sur la **semaine à venir** : dès le **jeudi**,
    c'est la semaine prochaine qui s'affiche (usage courant : on prépare le
    planning le jeudi ou le vendredi). Navigation semaine par semaine.
  - **Une personne ne peut pas être sur deux chantiers les mêmes jours** : le
    personnel déjà affecté ailleurs apparaît verrouillé (avec le nom du chantier
    concerné) et le serveur refuse toute affectation qui se chevauche.
  - Un bloc **« Personnel non affecté »** liste ceux qui n'ont pas encore de
    chantier pour la semaine affichée.
  - **Remplacements en cours de semaine** (un intérimaire quitte le chantier, un
    autre le remplace à partir d'un jour donné) ; si la personne remplacée
    encadrait l'équipe, son remplaçant **reprend le rôle de chef**.
- **Saisie quotidienne par chantier** : pour chaque personne de l'équipe, pointer
  - le **travail**, au choix : **heure d'arrivée / heure d'arrêt** (+ pause) ou
    directement le **total d'heures effectuées** dans la journée,
  - une **absence** (congé payé, RTT, maladie, formation, injustifiée…),
  - une **intempérie** (heures perdues, avec logique de chômage-intempéries BTP),
  - un **accident du travail** (gravité, circonstances, rappel du délai de déclaration 48 h).
- **Personnel** : chaque personne a sa **catégorie** (ouvrier, ETAM, cadre, apprenti)
  et son **métier** ; **salarié** interne, **intérimaire** (rattaché à une agence),
  **stagiaire** ou **alternant** — tous suivis dans les équipes.
- **Exports PDF mensuels** :
  - **relevé de facturation intérim (ETT)** : pour chaque intérimaire et chaque
    chantier, **ventilation par semaine** (S21, S22…) des heures **normales**,
    **supplémentaires (+25 %/+50 %)**, **fériées** (jours fériés français
    calculés automatiquement) et **intempéries**, avec **paniers repas**,
    **indemnités de déplacement**, **prix unitaires** et **totaux** — pour
    comparer et vérifier les factures des agences ;
    impression **filtrable par agence, par chantier ou par catégorie** ;
  - **relevé salariés / stagiaires / alternants** : détail des **heures par chantier** ;
  - **relevé d'heures individuel** (par personne, sur une **période libre**) :
    jour par jour avec **heure d'arrivée, heure d'arrêt**, pause et heures
    effectuées, totaux de la période, ventilation des heures supplémentaires par
    semaine et **zones de signature** — le justificatif à remettre au salarié.
- **Coûts par chantier** (vue admin) : à la création d'une personne, on renseigne
  ce qu'elle **coûte** — salaire horaire chargé, **panier repas**, **indemnité de
  déplacement** — et cela **en fonction de chaque chantier** (zones différentes).
- **Tableaux de bord / bilan** jour / semaine / mois : heures et **coûts**
  (main d'œuvre, paniers, déplacements, intempéries) **par personne, par chantier,
  par agence d'intérim / interne**.
- **Heures supplémentaires** calculées selon les paliers BTP (35 h légales, +25 %
  puis +50 %) et intégrées à l'estimation de **paie hebdomadaire**.
- **Local-first** : IndexedDB côté terrain + synchronisation avec le serveur (résolution de conflits déterministe).
- **PWA installable** (mobile, tablette, PC) fonctionnant hors-ligne.

## Architecture

```
src/
  core/        Cœur métier PUR (aucune I/O) — fortement testé
    types.ts     Modèle de domaine + constantes du droit du travail BTP
    dates.ts     Dates ISO, semaines ISO-8601, mois
    time.ts      Calcul d'heures, heures sup., indemnités intempéries
    rules.ts     Validation des pointages, doublons, délais accident
    reports.ts   Agrégations jour/semaine/mois, par personne/chantier/agence
    assignments.ts Affectations d'équipes & remplacements en cours de semaine
    cost.ts      Coûts (salaire, panier, déplacement) + paie hebdo avec heures sup.
    sync.ts      Fusion local-first & résolution de conflits
  server/      API REST (Express) + persistance SQLite (better-sqlite3, WAL)
    db.ts, repository.ts, api.ts, index.ts, seed.ts
web/           PWA (HTML/CSS/JS natifs, sans build)
    index.html, app.js, store.js (IndexedDB + synchro), domain.js, sw.js
e2e/           Test end-to-end navigateur (Playwright)
```

Le **cœur métier** est isolé de toute dépendance technique : c'est là que vit la
« logique derrière » (paie, majorations, intempéries, accidents), et c'est la
partie la plus densément testée pour garantir la **durabilité**.

## Comptes & rôles

L'application est protégée par des **comptes** (identifiant + mot de passe) :

| Rôle | Droits |
|---|---|
| **Chef de chantier** | pointe son équipe, consulte planning et rapports (sans les coûts) — **uniquement sur les chantiers où il est lui-même affecté** |
| **Conducteur de travaux** | + affectations d'équipes, remplacements, référentiel (personnel, chantiers, agences) |
| **Administrateur** | + coûts, relevés PDF, **gestion des comptes** (Profil → Comptes & rôles) |

**Le chef de chantier est un salarié** : son compte est rattaché à sa fiche
personnel (Profil → Comptes & rôles → *Salarié correspondant*). À l'ouverture de
l'application, il se retrouve directement sur le chantier où le conducteur l'a
affecté, et ne voit que celui-là. Changer son affectation suffit à le déplacer
d'un chantier à l'autre — aucun réglage de son côté.

Au premier démarrage, le serveur crée le compte **admin / admin** (affiché dans
la console) — **changez ce mot de passe immédiatement** puis créez les comptes
de vos chefs et conducteurs depuis Profil → Comptes & rôles.

## Mise en service dans l'entreprise (quelle adresse de serveur ?)

Le serveur s'installe sur **un ordinateur de l'entreprise** (PC du bureau qui
reste allumé, ou petit serveur/VPS) :

```bash
npm install && npm run build && npm start
```

Au démarrage, le serveur **affiche l'adresse à utiliser**, par exemple :

```
TDMI Pointage — serveur démarré
  Sur cet ordinateur : http://localhost:3000
  Depuis les téléphones du même réseau, saisissez cette adresse
  dans l'écran de connexion :
    → http://192.168.1.20:3000
```

- **Sur les téléphones** (app Android ou navigateur) : saisir cette adresse
  dans le champ « Adresse du serveur » de l'écran de connexion.
- **Sur un ordinateur** (partie web, pour les admins) : ouvrir directement
  `http://192.168.1.20:3000` dans le navigateur. L'interface bascule
  automatiquement en **mode poste de travail** : barre latérale de navigation
  avec le compte connecté, pleine largeur, tableaux de bord sur plusieurs
  colonnes, tableaux denses, et surtout un **tableau de pointage éditable au
  clavier** (arrivée, arrêt, pause ou total d'heures, en tabulant d'un champ à
  l'autre) — beaucoup plus rapide que la saisie tactile pour rattraper une
  semaine entière. Le champ adresse peut rester vide.
- Pour un accès **hors du réseau de l'entreprise** (4G), il faut un serveur
  accessible d'Internet (VPS à ~5 €/mois avec un nom de domaine et HTTPS) —
  la même commande `npm start` s'y applique.

## Démarrage

```bash
npm install
npm run seed        # (optionnel) jeu de données de démonstration
npm run dev         # serveur de développement : http://localhost:3000
```

En production :

```bash
npm run build && npm start
```

Variables d'environnement : `PORT` (défaut 3000), `DB_PATH` (défaut `data/pointage.db`).

## Tests (résistance / durabilité)

```bash
npm test            # tests unitaires du cœur + tests d'intégration API (Vitest)
npm run test:e2e    # parcours complet dans un vrai navigateur (Playwright)
npm run typecheck   # vérification TypeScript stricte
```

- **Unitaires** : calculs d'heures, paliers d'heures sup., semaines ISO, règles
  de validation, agrégations, fusion de synchronisation.
- **Intégration** : API (référentiels, pointages, rapports, push/pull de synchro,
  contrainte anti-doublon).
- **E2E** : saisie réelle dans l'UI → IndexedDB → API → SQLite → tableau de bord.

## Modèle de données

- **Chantier** : code unique, nom, client, adresse, période.
- **Personne** (`Worker`) : employé ou intérimaire, **catégorie**, métier, agence
  (si intérim), coût horaire par défaut.
- **Agence** d'intérim.
- **Grille de coût** (`CostRate`) : par (personne × chantier) — salaire horaire chargé,
  panier repas, indemnité de déplacement.
- **Affectation** (`Assignment`) : personne × chantier sur une période (semaine),
  avec chaînage de **remplacement** en cours de semaine.
- **Pointage** (`TimeEntry`) : personne × chantier × jour, nature (travail / absence /
  intempérie / accident), minutes, détails, versionné pour la synchronisation.

## Sécurité & suites possibles

Cette base fournit une fondation fonctionnelle. Les évolutions naturelles :
- **Authentification** des chefs de chantier et rôles (chef, conducteur de travaux, RH).
- Export **PDF / Excel** des relevés pour la paie et la facturation intérim.
- Rapprochement automatique avec les **relevés d'agence**.
- Notifications (accident déclaré, seuil d'heures sup. atteint).
