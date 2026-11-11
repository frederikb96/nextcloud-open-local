#!/bin/sh
# Regenerates the extension icons from docs/images/logo.png (needs ImageMagick).
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
for size in 16 48 128; do
  magick "$root/docs/images/logo.png" -filter Lanczos -resize "${size}x${size}" "PNG32:$root/icons/icon-$size.png"
done
