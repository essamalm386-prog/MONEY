# Application Android TDMI Pointage

L'application mobile empaquette la PWA (`web/`) dans une coquille native Android
via **Capacitor**. Elle porte le **nom** « TDMI Pointage » et le **logo TDMI**,
fonctionne **hors-ligne** (IndexedDB) et se connecte à votre serveur de pointage
via l'écran **Réglages** (icône ⚙️).

> Le projet natif est déjà généré dans `android/`. Il ne reste qu'à le compiler
> sur un poste disposant du SDK Android (l'environnement d'édition en ligne n'a
> pas accès aux serveurs Google pour télécharger le SDK).

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

## Prérequis pour compiler

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

## Compiler l'APK

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
