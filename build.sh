#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

tsc
rm -rf build/public
if [ -d "src/public" ]; then
  mkdir -p build/public
  cp -a src/public/. build/public/
else
  echo "src/public directory not found, skipping copy."
fi

if [ -f "build/index.js" ]; then
  chmod 755 build/index.js
else
  echo "Warning: build/index.js not found. Cannot set permissions."
fi

echo "Build process completed successfully."