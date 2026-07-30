# Pointage BTP

Outil de **pointage des heures** des intérimaires et employés **par chantier**, destiné aux **chefs de chantier** pour saisir chaque jour les heures travaillées par leur équipe. La hiérarchie dispose ainsi, **en temps réel**, des justificatifs (jour / semaine / mois) au lieu d'attendre les relevés papier.

L'application **fonctionne en local et en ligne** : saisie possible **hors-ligne** sur le chantier (stockage local), puis **synchronisation automatique** dès qu'une connexion est disponible.

## Fonctionnalités

- **Saisie quotidienne par chantier** : pour chaque personne de l'équipe, pointer
  - le **travail** (créneau début/fin + pause, ou total d'heures),
  - une **absence** (congé payé, RTT, maladie, formation, injustifiée…),
  - une **intempérie** (heures perdues, avec logique de chômage-intempéries BTP),
  - un **accident du travail** (gravité, circonstances, rappel du délai de déclaration 48 h).
- **Tableaux de bord** jour / semaine / mois, avec synthèse **par personne, par chantier, par agence d'intérim / interne**.
- **Heures supplémentaires** calculées selon les paliers (35 h légales, +25 % puis +50 %).
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
- **Personne** (`Worker`) : employé ou intérimaire, métier, agence (si intérim), taux horaire.
- **Agence** d'intérim.
- **Pointage** (`TimeEntry`) : personne × chantier × jour, nature (travail / absence /
  intempérie / accident), minutes, détails, versionné pour la synchronisation.

## Sécurité & suites possibles

Cette base fournit une fondation fonctionnelle. Les évolutions naturelles :
- **Authentification** des chefs de chantier et rôles (chef, conducteur de travaux, RH).
- Export **PDF / Excel** des relevés pour la paie et la facturation intérim.
- Rapprochement automatique avec les **relevés d'agence**.
- Notifications (accident déclaré, seuil d'heures sup. atteint).
