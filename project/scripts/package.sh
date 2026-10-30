#!/bin/bash
# Assemble the deliverable folder (renders + sources + project) and zip it.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=${1:-otkrovenno_creo_ua_$(date +%Y%m%d)}
STAGE=build/package/$NAME
rm -rf build/package && mkdir -p "$STAGE"/renders "$STAGE"/source/{backgrounds,layers,layers_png,audio,texts,in,project}
cp -r build/renders/9x16 build/renders/3x4 "$STAGE/renders/"
cp docs/README.md docs/preview.html "$STAGE/"
cp -r build/backgrounds/9x16 build/backgrounds/3x4 "$STAGE/source/backgrounds/"
cp -r build/layers/9x16 build/layers/3x4 "$STAGE/source/layers/"
[ -d build/layers_png ] && cp -r build/layers_png/* "$STAGE/source/layers_png/"
cp -r build/audio/music build/audio/sfx build/audio/mix "$STAGE/source/audio/"
cp build/audio/manifest.json "$STAGE/source/audio/" 2>/dev/null || true
cp docs/texts_ua.txt "$STAGE/source/texts/"
cp assets/in/* "$STAGE/source/in/"
# render project: code, content, fonts, brand icon (no node_modules / build / caches / input media)
rsync -a --exclude node_modules --exclude build --exclude assets/cache --exclude assets/in --exclude 'assets/fonts/_var' --exclude .gitignore ./ "$STAGE/source/project/"
mkdir -p "$STAGE/source/project/assets/in" && echo "Скопируйте сюда файлы из source/in/ перед рендером." > "$STAGE/source/project/assets/in/README.txt"
(cd build/package && zip -qr -X "../$NAME.zip" "$NAME")
ls -la "build/$NAME.zip"
