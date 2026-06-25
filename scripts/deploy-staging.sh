#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.staging.yml"
DB_CONTAINER="drizatx-stg-mysql"
BACKEND_CONTAINER="drizatx-stg-backend"
DB_NAME="drizatx"
DB_USER="driza"
DB_PASSWORD="DrizaDB_2025"
BACKEND_HEALTH_URL="http://127.0.0.1:3101/api/health"
BACKUP_DIR="/root"

echo "=== DRIZATX STAGING DEPLOY ==="

echo ""
echo "=== GIT STATUS ==="
git status --short

echo ""
echo "=== BUILD BACKEND ==="
docker compose -f "$COMPOSE_FILE" build backend

echo ""
echo "=== START DB + BACKEND ==="
docker compose -f "$COMPOSE_FILE" up -d db backend

echo ""
echo "=== WAIT MYSQL ==="
for i in $(seq 1 60); do
  if docker exec "$DB_CONTAINER" mysqladmin -u "$DB_USER" -p"$DB_PASSWORD" ping >/dev/null 2>&1; then
    echo "MySQL is ready"
    break
  fi

  if [ "$i" -eq 60 ]; then
    echo "ERROR: MySQL did not become ready"
    docker logs --tail 120 "$DB_CONTAINER" || true
    exit 1
  fi

  sleep 2
done

echo ""
echo "=== BACKUP DB ==="
BACKUP_FILE="$BACKUP_DIR/backup_drizatx_staging_before_deploy_$(date +%F_%H%M%S).sql"

docker exec "$DB_CONTAINER" mysqldump \
  --no-tablespaces \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  "$DB_NAME" > "$BACKUP_FILE"

ls -lh "$BACKUP_FILE"

echo ""
echo "=== RUN MIGRATIONS ==="
docker exec "$BACKEND_CONTAINER" npm run migration:run:prod

echo ""
echo "=== VERIFY MIGRATIONS ==="
docker exec "$DB_CONTAINER" mysql \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  "$DB_NAME" \
  -e "
    SELECT id, timestamp, name
    FROM migrations
    ORDER BY id DESC
    LIMIT 5;
  "

echo ""
echo "=== HEALTHCHECK BACKEND ==="
for i in $(seq 1 30); do
  if curl -fsS "$BACKEND_HEALTH_URL" >/dev/null; then
    echo "Backend health OK"
    break
  fi

  if [ "$i" -eq 30 ]; then
    echo "ERROR: backend healthcheck failed"
    docker logs --tail 160 "$BACKEND_CONTAINER" || true
    exit 1
  fi

  sleep 2
done

echo ""
echo "=== DEPLOY STAGING OK ==="
