#!/usr/bin/env bash
# Compile et lance les tests du moteur metier, sans Android.
#
# Le moteur ne depend que de la bibliotheque standard Kotlin et de
# java.time : il se compile donc sur n'importe quelle machine avec un
# JDK, sans SDK Android ni emulateur. C'est la boucle de retour la
# plus rapide du projet — quelques secondes contre plusieurs minutes
# en integration continue.
#
# Les memes fichiers sont ensuite compiles par Gradle dans
# l'application : ce script ne duplique rien, il les lit en place.
#
# Prerequis : outils/telecharger-kotlin.sh
# Usage     : outils/verifier-metier-kotlin.sh

set -euo pipefail

racine="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lib="${DRESS_CODE_LIB:-$racine/.kotlin-lib}"
build="$(mktemp -d)"
trap 'rm -rf "$build"' EXIT

if [ ! -x "$lib/kotlinc/bin/kotlinc" ]; then
  echo "Compilateur Kotlin absent. Lancer d'abord :"
  echo "  outils/telecharger-kotlin.sh"
  exit 1
fi

classes="$lib/junit-4.13.2.jar:$lib/hamcrest-core-1.3.jar"

echo "Compilation du moteur metier…"
"$lib/kotlinc/bin/kotlinc" \
  "$racine/android/app/src/main/kotlin/com/essama/dresscode/metier" \
  "$racine/android/app/src/main/kotlin/com/essama/dresscode/partage/Textes.kt" \
  "$racine/android/app/src/test/kotlin/com/essama/dresscode/metier" \
  "$racine/android/app/src/test/kotlin/com/essama/dresscode/partage" \
  -classpath "$classes" \
  -d "$build/classes" \
  -jvm-target 17 \
  -nowarn

echo "Execution des tests…"
java -cp "$build/classes:$classes:$lib/kotlinc/lib/kotlin-stdlib.jar" \
  org.junit.runner.JUnitCore \
  com.essama.dresscode.metier.MoteurMetierTest \
  com.essama.dresscode.partage.TextesTest
