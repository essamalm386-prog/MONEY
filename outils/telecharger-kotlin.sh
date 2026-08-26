#!/usr/bin/env bash
# Recupere de quoi compiler et tester le moteur metier hors Android.
# Tout va dans .kotlin-lib/, ignore par git.
set -euo pipefail

racine="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lib="$racine/.kotlin-lib"
version=2.0.21
mkdir -p "$lib"

if [ ! -x "$lib/kotlinc/bin/kotlinc" ]; then
  echo "Telechargement du compilateur Kotlin $version…"
  curl -sSL -o "$lib/kotlinc.zip" \
    "https://github.com/JetBrains/kotlin/releases/download/v$version/kotlin-compiler-$version.zip"
  unzip -q -o "$lib/kotlinc.zip" -d "$lib"
  rm -f "$lib/kotlinc.zip"
  chmod +x "$lib/kotlinc/bin/"*
fi

depot=https://repo1.maven.org/maven2
for artefact in \
  "junit/junit/4.13.2/junit-4.13.2.jar" \
  "org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar" ; do
  fichier="$lib/$(basename "$artefact")"
  [ -f "$fichier" ] && continue
  echo "Telechargement $(basename "$artefact")…"
  curl -sSL -o "$fichier" "$depot/$artefact"
done

echo "Pret : outils/verifier-metier-kotlin.sh"
