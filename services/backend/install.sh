#!/bin/sh

green='\e[1;32m%s\e[0m\n'

set -eu

SERVICE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SERVICE_DIR"

FRESH_DB=false
REBUILD=false
for arg in "$@"; do
  case "$arg" in
    --fresh-db) FRESH_DB=true ;;
    --rebuild)  REBUILD=true ;;
  esac
done

printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# OpenPlay Backend Installer"
printf "$green" "# "
printf "$green" "#######################################################################"

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [1/7] Copying default environment file."
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
printf "$green" "# [2/7] Preparing npm cache and shared API network."
printf "$green" "# "
printf "$green" "#######################################################################"
mkdir -p storage/npm
if ! docker network inspect openplay-local-api >/dev/null 2>&1; then
  docker network create openplay-local-api
fi

echo ""
if [ "$FRESH_DB" = true ]; then
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [3/7] Shutting down containers and deleting backend_postgres_data."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  docker compose down -v
else
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [3/7] Shutting down existing backend containers."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  docker compose down
fi

echo ""
if [ "$REBUILD" = true ]; then
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [4/7] Rebuilding docker images."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  rm -Rf node_modules/
  docker compose build
else
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [4/7] Rebuilding docker images. Skipped."
  printf "$green" "# "
  printf "$green" "#######################################################################"
fi

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [5/7] Installing Node.js dependencies."
printf "$green" "# "
printf "$green" "#######################################################################"
docker compose run --rm npm install --no-audit

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [6/7] Starting PostgreSQL and running migrations."
printf "$green" "# "
printf "$green" "#######################################################################"
docker compose up -d --wait postgres
docker compose run --rm backend npm run db:generate
docker compose run --rm backend npm run db:migrate

echo ""
printf "$green" "#######################################################################"
printf "$green" "# "
printf "$green" "# [7/7] Starting the backend API as a daemon."
printf "$green" "# "
printf "$green" "#######################################################################"
docker compose up -d backend
