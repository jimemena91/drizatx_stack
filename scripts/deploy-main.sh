#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/drizatx_worktrees/main"
EXPECTED_BRANCH="main"
EXPECTED_DB_IMAGE="mysql:8"
EXPECTED_DB_VOLUME="main_db_data"
EXPECTED_DB_CONTAINER="drizatx-main-db"
EXPECTED_BACKEND_CONTAINER="drizatx-main-backend"
EXPECTED_FRONTEND_CONTAINER="drizatx-main-frontend"
HEALTH_URL="http://127.0.0.1:3201/api/health"

cd "$APP_DIR"

compose() {
  docker compose -p main -f docker-compose.yml "$@"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

echo "=================================================="
echo "DRIZATX MAIN - DESPLIEGUE PROTEGIDO"
echo "=================================================="

echo
echo "1. VALIDAR REPOSITORIO"

CURRENT_BRANCH="$(git branch --show-current)"
[ "$CURRENT_BRANCH" = "$EXPECTED_BRANCH" ] ||
  fail "rama incorrecta: $CURRENT_BRANCH"

[ -z "$(git status --porcelain)" ] ||
  fail "el repositorio tiene cambios sin commit"

git fetch origin main

LOCAL_COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse origin/main)"

[ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ] ||
  fail "HEAD no coincide con origin/main"

echo "Rama=$CURRENT_BRANCH"
echo "Commit=$LOCAL_COMMIT"

echo
echo "2. VALIDAR COMPOSE CANÓNICO"

CONFIG_JSON="$(compose config --format json)"

RESOLVED_DB_IMAGE="$(
  printf '%s' "$CONFIG_JSON" |
    jq -r '.services.db.image'
)"

RESOLVED_DB_VOLUME="$(
  printf '%s' "$CONFIG_JSON" |
    jq -r '.volumes.db_data.name'
)"

[ "$RESOLVED_DB_IMAGE" = "$EXPECTED_DB_IMAGE" ] ||
  fail "imagen DB inesperada: $RESOLVED_DB_IMAGE"

[ "$RESOLVED_DB_VOLUME" = "$EXPECTED_DB_VOLUME" ] ||
  fail "volumen DB inesperado: $RESOLVED_DB_VOLUME"

echo "Compose=docker-compose.yml"
echo "Proyecto=main"
echo "ImagenDB=$RESOLVED_DB_IMAGE"
echo "VolumenDB=$RESOLVED_DB_VOLUME"

echo
echo "3. VALIDAR MYSQL ACTIVO"

docker inspect "$EXPECTED_DB_CONTAINER" >/dev/null 2>&1 ||
  fail "no existe el contenedor $EXPECTED_DB_CONTAINER"

DB_STATUS="$(
  docker inspect "$EXPECTED_DB_CONTAINER"     --format '{{.State.Status}}'
)"

DB_IMAGE="$(
  docker inspect "$EXPECTED_DB_CONTAINER"     --format '{{.Config.Image}}'
)"

DB_PROJECT="$(
  docker inspect "$EXPECTED_DB_CONTAINER"     --format '{{index .Config.Labels "com.docker.compose.project"}}'
)"

DB_CONFIG_FILES="$(
  docker inspect "$EXPECTED_DB_CONTAINER"     --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'
)"

DB_VOLUME="$(
  docker inspect "$EXPECTED_DB_CONTAINER"     --format '{{range .Mounts}}{{if eq .Destination "/var/lib/mysql"}}{{.Name}}{{end}}{{end}}'
)"

[ "$DB_STATUS" = "running" ] ||
  fail "MySQL no está en ejecución: $DB_STATUS"

[ "$DB_IMAGE" = "$EXPECTED_DB_IMAGE" ] ||
  fail "MySQL activo usa una imagen incorrecta: $DB_IMAGE"

[ "$DB_PROJECT" = "main" ] ||
  fail "MySQL pertenece al proyecto incorrecto: $DB_PROJECT"

[ "$DB_CONFIG_FILES" = "$APP_DIR/docker-compose.yml" ] ||
  fail "MySQL fue creado con otro Compose: $DB_CONFIG_FILES"

[ "$DB_VOLUME" = "$EXPECTED_DB_VOLUME" ] ||
  fail "MySQL usa un volumen incorrecto: $DB_VOLUME"

echo "EstadoDB=$DB_STATUS"
echo "ImagenDB=$DB_IMAGE"
echo "VolumenDB=$DB_VOLUME"
echo "ComposeDB=$DB_CONFIG_FILES"

echo
echo "4. CONSTRUIR APLICACIÓN"

compose build backend frontend

echo
echo "5. PREPARAR MIGRACIONES"

compose run --rm --no-deps backend npm run deploy:prepare

echo
echo "6. ACTUALIZAR SOLO BACKEND Y FRONTEND"

compose up -d --no-deps backend frontend

echo
echo "7. ESPERAR BACKEND"

HEALTH_OK=0

for attempt in $(seq 1 30); do
  HTTP_CODE="$(
    curl -sS       -o /tmp/drizatx-main-health.json       -w '%{http_code}'       "$HEALTH_URL" ||
      true
  )"

  echo "Intento $attempt: HTTP ${HTTP_CODE:-000}"

  if [ "$HTTP_CODE" = "200" ]; then
    HEALTH_OK=1
    break
  fi

  sleep 2
done

if [ "$HEALTH_OK" -ne 1 ]; then
  echo "===== ESTADO DE SERVICIOS ====="
  compose ps || true

  echo "===== LOGS BACKEND ====="
  docker logs --tail 200 "$EXPECTED_BACKEND_CONTAINER" || true

  echo "===== LOGS FRONTEND ====="
  docker logs --tail 200 "$EXPECTED_FRONTEND_CONTAINER" || true

  fail "el backend no superó el healthcheck"
fi

echo
echo "8. VERIFICACIÓN FINAL"

cat /tmp/drizatx-main-health.json
echo

compose ps

for container in   "$EXPECTED_DB_CONTAINER"   "$EXPECTED_BACKEND_CONTAINER"   "$EXPECTED_FRONTEND_CONTAINER"
do
  docker inspect "$container"     --format 'Contenedor={{.Name}} Estado={{.State.Status}} Reinicios={{.RestartCount}}'
done

echo
echo "DEPLOY MAIN OK"
