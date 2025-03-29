#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e


tsc
rm -rf build/public
# Build React application
npm run build:react

echo "Build process completed successfully."