#!/bin/sh

green='\e[1;32m%s\e[0m\n'

set -eu

SERVICE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SERVICE_DIR"

REBUILD=false
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=true ;;
  esac
done

printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# OpenPlay Player Portal Installer"
printf "$green" "# "
printf "$green" "#######################################################################"

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [1/5] Copying default environment file."
printf "$green" "# "
if [ ! -f .env ]; then
  cp .env.example .env
  printf "$green" "# Copied .env"
else
  printf "$green" "# File .env already exists."
fi
printf "$green" "# "
printf "$green" "#######################################################################"

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [2/5] Preparing npm cache and checking the shared API network."
printf "$green" "# "
printf "$green" "#######################################################################"
mkdir -p storage/npm
if ! docker network inspect openplay-local-api >/dev/null 2>&1; then
  printf '%s\n' "Run services/backend/install.sh first to create the shared API network." >&2
  exit 1
fi

echo ""
if [ "$REBUILD" = true ]; then
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [3/5] Rebuilding docker images."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  rm -Rf node_modules/
  docker compose build
else
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [3/5] Rebuilding docker images. Skipped."
  printf "$green" "# "
  printf "$green" "#######################################################################"
fi

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [4/5] Installing Node.js dependencies."
printf "$green" "# "
printf "$green" "#######################################################################"
docker compose run --rm npm install --no-audit

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [5/5] Starting the Player Portal as a daemon."
printf "$green" "# "
printf "$green" "#######################################################################"
docker compose up -d player-portal
