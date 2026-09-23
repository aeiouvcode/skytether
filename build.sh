#!/bin/sh
set -e
cd "$(dirname "$0")"
mkdir -p dist
npx esbuild src/main.js --bundle --minify --format=iife --target=es2020 --outfile=dist/game.js --log-level=warning
cp src/index.html src/style.css dist/
