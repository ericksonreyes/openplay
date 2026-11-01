#!/bin/sh

green='\e[1;32m%s\e[0m\n'

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT_DIR"

QUICK_MODE=false
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK_MODE=true ;;
  esac
done

if [ "$QUICK_MODE" = true ]; then
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# OpenPlay Installer (Quick Mode)"
  printf "$green" "# "
  printf "$green" "#######################################################################"
  choice="Y"
  fresh_database="N"
  rebuild="N"
else
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# OpenPlay Installer."
  printf "$green" "# "
  printf "$green" "# This requires the following to be installed on your computer:"
  printf "$green" "# 1. Docker - https://www.docker.com/"
  printf "$green" "# "
  printf "$green" "# Do you want to install OpenPlay on your computer? [Y/n]"
  printf "$green" "# "
  printf "$green" "#######################################################################"
  read -r choice
fi

if [ "$choice" = "Y" ] || [ -z "$choice" ]; then
  SECONDS=0

  if [ "$QUICK_MODE" = false ]; then
    printf "$green" "#######################################################################"
    printf "$green" "# "
    printf "$green" "# Do you want a fresh database? [y/N]"
    printf "$green" "# "
    printf "$green" "# This will:"
    printf "$green" "# 1. Stop the backend containers."
    printf "$green" "# 2. Delete the backend_postgres_data volume."
    printf "$green" "# "
    printf "$green" "#######################################################################"
    read -r fresh_database

    printf "$green" "#######################################################################"
    printf "$green" "# "
    printf "$green" "# Do you want to rebuild project dependencies? [Y/n]"
    printf "$green" "# "
    printf "$green" "# This will:"
    printf "$green" "# 1. Delete node_modules/ folders."
    printf "$green" "# 2. Rebuild docker images."
    printf "$green" "# "
    printf "$green" "#######################################################################"
    read -r rebuild
  fi

  backend_flags=""
  { [ "${fresh_database:-N}" = "Y" ] || [ "${fresh_database:-N}" = "y" ]; } && backend_flags="$backend_flags --fresh-db" || true
  { [ "${rebuild:-N}" = "Y" ] || [ -z "${rebuild:-}" ]; } && backend_flags="$backend_flags --rebuild" || true
  frontend_flags=""
  { [ "${rebuild:-N}" = "Y" ] || [ -z "${rebuild:-}" ]; } && frontend_flags="--rebuild" || true

  echo ""
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [1/6] Checking Docker."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  docker compose version >/dev/null
  docker info >/dev/null

  echo ""
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# [2/6] Installing the backend."
  printf "$green" "# "
  printf "$green" "#######################################################################"
  ./services/backend/install.sh $backend_flags

  step=3
  for service in public-site player-portal venue-portal platform-portal; do
    echo ""
    printf "$green" "#######################################################################"
    printf "$green" "# "
    printf "$green" "# [$step/6] Installing $service."
    printf "$green" "# "
    printf "$green" "#######################################################################"
    ./services/"$service"/install.sh $frontend_flags
    step=$((step + 1))
  done

  t=$SECONDS
  echo ""
  printf "$green" "#######################################################################"
  printf "$green" "# "
  printf "$green" "# OpenPlay installed!"
  printf "$green" "# Done in $(( t / 60 )) minutes and $(( t % 60 )) seconds."
  printf "$green" "# "
  printf "$green" "#######################################################################"

  for service in backend public-site player-portal venue-portal platform-portal; do
    (cd "services/$service" && docker compose ps)
  done
fi
