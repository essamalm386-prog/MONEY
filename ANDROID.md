# Application Android TDMI Pointage

L'application mobile empaquette la PWA (`web/`) dans une coquille native Android
via **Capacitor**. Elle porte le **nom** « TDMI Pointage » et le **logo TDMI**,
fonctionne **hors-ligne** (IndexedDB) et se connecte à votre serveur de pointage
via l'écran **Réglages** (icône ⚙️).

> **L'APK est compilé automatiquement par GitHub Actions** à chaque push : rien à
> installer sur votre poste, vous le téléchargez depuis l'onglet *Actions*.
> Voir « [Build automatique de l'APK](#build-automatique-de-lapk-github-actions--recommandé) ».

## Identité de l'app

- **Nom** : TDMI Pointage (`android/app/src/main/res/values/strings.xml`)
- **Identifiant** : `fr.tdmi.pointage` (`capacitor.config.ts`)
- **Icône** : logo TDMI (toit orange + « TDMI » bleu), fond blanc — icône
  adaptative (`mipmap-*`), fond blanc `#FFFFFF`.

### Utiliser le logo officiel TDMI

Les icônes sont générées à partir de `web/icons/icon.svg` (fond blanc) et
`web/icons/tdmi-foreground.svg` (fond transparent). Pour utiliser le fichier
officiel, remplacez ces deux SVG (ou fournissez un PNG 1024×1024) puis relancez :

```bash
npm run android:icons   # régénère toutes les densités mipmap
```

## Build automatique de l'APK (GitHub Actions) — recommandé

Un workflow (`.github/workflows/android.yml`) **compile l'APK automatiquement**
à chaque push, sans rien installer sur votre poste.

### Récupérer l'APK

1. Sur GitHub, ouvrez l'onglet **Actions** → workflow **« APK Android (TDMI Pointage) »**.
2. Cliquez sur le dernier run réussi (✅).
3. Section **Artifacts** en bas → téléchargez `TDMI-Pointage-<version>` (un ZIP contenant l'APK).
4. Transférez l'APK sur le téléphone et installez-le (autoriser « sources inconnues »).

Le workflow se déclenche aussi **manuellement** (bouton *Run workflow*) et
**sur tag** : pousser un tag `v1.2.0` crée une **Release GitHub** avec l'APK attaché
— la façon la plus simple de distribuer une version aux chefs de chantier.

Le build est **protégé par les tests** : la vérification de types et les tests
unitaires/intégration tournent avant la compilation ; si la logique métier est
cassée, aucun APK n'est publié.

### ⚠️ APK de debug vs APK de release signé

- **APK de debug** (toujours produit) : parfait pour tester rapidement. Mais il est
  signé avec une clé temporaire **régénérée à chaque build** — Android refusera
  donc d'installer une nouvelle version par-dessus l'ancienne (« signatures
  différentes ») et il faudra **désinstaller avant de réinstaller**.
- **APK de release signé** (produit si vous configurez le keystore, ci-dessous) :
  signé avec **votre** clé, stable dans le temps → les **mises à jour
  s'installent normalement**, sans désinstallation. **C'est ce qu'il faut pour un
  déploiement réel dans l'entreprise.**

### Configurer la signature (à faire une fois)

1. Créez un keystore (à conserver précieusement et à sauvegarder — le perdre
   empêche toute mise à jour future de l'app) :

   ```bash
   keytool -genkeypair -v -keystore tdmi-release.jks \
     -alias tdmi -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Encodez-le en base64 :

   ```bash
   base64 -w0 tdmi-release.jks > tdmi-release.b64
   ```

3. Sur GitHub : **Settings → Secrets and variables → Actions → New repository secret**,
   créez ces quatre secrets :

   | Secret | Valeur |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | contenu de `tdmi-release.b64` |
   | `ANDROID_KEYSTORE_PASSWORD` | mot de passe du keystore |
   | `ANDROID_KEY_ALIAS` | `tdmi` (l'alias choisi) |
   | `ANDROID_KEY_PASSWORD` | mot de passe de la clé |

Au prochain build, l'APK **`...-release.apk`** apparaîtra à côté de l'APK de debug.
Sans ces secrets, le workflow reste fonctionnel et ne produit que l'APK de debug.

## Compiler soi-même (optionnel)

### Prérequis

1. **JDK 17+** (Java 21 fonctionne avec Gradle ≥ 8.5).
2. **Android Studio** (recommandé) ou le **SDK Android en ligne de commande** avec :
   - `platform-tools`
   - `platforms;android-34`
   - `build-tools;34.0.0`
3. Un fichier `android/local.properties` pointant sur le SDK :
   ```
   sdk.dir=/chemin/vers/Android/Sdk
   ```
   (Android Studio le crée automatiquement à l'ouverture du projet.)

### Option A — Android Studio (le plus simple)

```bash
npm install
npm run cap:sync          # copie web/ dans le projet Android
npm run android:open      # ouvre le projet dans Android Studio
```
Puis : **Build > Build Bundle(s) / APK(s) > Build APK(s)**. L'APK de débogage est
produit dans `android/app/build/outputs/apk/debug/app-debug.apk`.

### Option B — Ligne de commande

```bash
npm install
npm run cap:sync
cd android
# Java 21 : utilisez un Gradle ≥ 8.5 (le wrapper est en 8.2.1).
gradle assembleDebug      # ou ./gradlew si vous ajustez la version du wrapper
```

Pour un APK **de release signé**, créez un keystore et configurez
`signingConfigs` dans `android/app/build.gradle` (voir la doc Android « Sign your
app »), puis `gradle assembleRelease`.

## Après chaque modification de l'interface

Le code de l'UI vit dans `web/`. Après toute modification :

```bash
npm run cap:sync          # resynchronise web/ vers android/
```

## Première utilisation sur le téléphone

1. Installer l'APK.
2. Ouvrir **TDMI Pointage**, toucher **⚙️ Réglages**.
3. Saisir l'**URL du serveur** de pointage (ex. `https://pointage.tdmi.fr`),
   **Enregistrer** → un test de connexion confirme l'accès.
4. Le chef de chantier peut alors pointer ; la synchronisation est automatique
   dès qu'il y a du réseau, et la saisie reste possible hors-ligne.

> En production, préférez un serveur **HTTPS**. Un serveur local en HTTP est
> toléré (`allowMixedContent` est activé dans `capacitor.config.ts`).
