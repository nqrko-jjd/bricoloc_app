#!/bin/sh
# Premier certificat Let's Encrypt (à lancer UNE fois, après avoir fait pointer
# le DNS du domaine vers le VPS).  Ensuite, le service `certbot` renouvelle seul.
#
#   cd /opt/bricoloc && ./deploy/init-letsencrypt.sh
set -eu

ENV_FILE="${ENV_FILE:-.env.production}"
[ -f "$ENV_FILE" ] || { echo "Fichier $ENV_FILE introuvable"; exit 1; }
# shellcheck disable=SC1090
. "./$ENV_FILE"

: "${DOMAIN:?DOMAIN manquant dans $ENV_FILE}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL manquant dans $ENV_FILE}"
STAGING="${CERTBOT_STAGING:-0}"

compose() { docker compose --env-file "$ENV_FILE" "$@"; }
LIVE="/etc/letsencrypt/live/$DOMAIN"

echo "→ Certificat provisoire auto-signé pour démarrer nginx…"
compose run --rm --entrypoint sh certbot -c "
  mkdir -p '$LIVE' &&
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout '$LIVE/privkey.pem' -out '$LIVE/fullchain.pem' \
    -subj '/CN=$DOMAIN'
"

echo "→ Démarrage de nginx…"
compose up -d nginx
sleep 3

echo "→ Suppression du provisoire et demande du vrai certificat…"
compose run --rm --entrypoint sh certbot -c "rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf"

STAGING_ARG=""
[ "$STAGING" = "1" ] && STAGING_ARG="--staging"

compose run --rm --entrypoint certbot certbot \
  certonly --webroot -w /var/www/certbot \
  $STAGING_ARG \
  --email "$CERTBOT_EMAIL" --agree-tos --no-eff-email \
  -d "$DOMAIN"

echo "→ Rechargement de nginx avec le vrai certificat…"
compose exec nginx nginx -s reload

echo "✔ HTTPS actif sur https://$DOMAIN"
