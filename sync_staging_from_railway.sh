#!/usr/bin/env bash
set -euo pipefail

#######################################
# Config
#######################################
PROJECT_DIR="/opt/drizatx_stack"

# Railway (PRODUCCIÓN)
RAILWAY_HOST="trolley.proxy.rlwy.net"
RAILWAY_PORT=18339
RAILWAY_USER="root"
RAILWAY_PASSWORD="SlxGugDGYgdOmiAktxDMTRwtPkYlZDcy"
RAILWAY_DB="railway"

# STAGING (Docker)
STG_DB_CONTAINER="drizatx-stg-mysql"
STG_DB_NAME="drizatx"
STG_DB_ROOT_PASSWORD="DrizaRootPass_2025"

TIMESTAMP="$(date +%F-%H%M%S)"
BACKUP_FILE="railway-backup-${TIMESTAMP}.sql"

echo "🚀 Sincronizando STAGING desde Railway..."
echo "📁 Directorio: ${PROJECT_DIR}"
cd "${PROJECT_DIR}"

echo
echo "⚠️ ATENCIÓN: Esto va a BORRAR la base '${STG_DB_NAME}' en STAGING y la va a recrear desde Railway."
read -p "¿Segura que querés continuar? (escribí YES y Enter): " CONFIRM

if [ "${CONFIRM}" != "YES" ]; then
  echo "❌ Cancelado por el usuario."
  exit 1
fi

#######################################
# 1) Dump desde Railway
#######################################
echo
echo "📥 Paso 1/4 – Generando dump desde Railway (${RAILWAY_HOST}:${RAILWAY_PORT}/${RAILWAY_DB})..."
docker run --rm mysql:8 \
  mysqldump \
    -h "${RAILWAY_HOST}" \
    -P "${RAILWAY_PORT}" \
    -u "${RAILWAY_USER}" \
    -p"${RAILWAY_PASSWORD}" \
    "${RAILWAY_DB}" > "${BACKUP_FILE}"

echo "✅ Dump generado: ${BACKUP_FILE}"

#######################################
# 2) Drop + create DB en STAGING
#######################################
echo
echo "🧹 Paso 2/4 – Borrando y recreando base '${STG_DB_NAME}' en STAGING..."
docker exec -i "${STG_DB_CONTAINER}" \
  mysql -u root -p"${STG_DB_ROOT_PASSWORD}" <<SQL
DROP DATABASE IF EXISTS ${STG_DB_NAME};
CREATE DATABASE ${STG_DB_NAME}
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
SQL

echo "✅ Base '${STG_DB_NAME}' recreada en STAGING."

#######################################
# 3) Importar dump de Railway → STAGING
#######################################
echo
echo "📤 Paso 3/4 – Importando dump en '${STG_DB_NAME}'..."
docker exec -i "${STG_DB_CONTAINER}" \
  mysql -u root -p"${STG_DB_ROOT_PASSWORD}" "${STG_DB_NAME}" < "${BACKUP_FILE}"

echo "✅ Dump importado en STAGING."

#######################################
# 4) Resetear clave de superadmin (opcional)
#######################################
echo
echo "🔐 Paso 4/4 – Asegurando clave conocida para superadmin..."
docker exec -i "${STG_DB_CONTAINER}" \
  mysql -u root -p"${STG_DB_ROOT_PASSWORD}" "${STG_DB_NAME}" <<'SQL'
UPDATE operators
SET password_hash = '$2b$10$Y5qNpOpg/if6qqmDR6cLuen2Bxv4nxvNOaEYkK713UyRIrlTRrV8S'
WHERE username = 'superadmin';
SQL

echo "✅ Clave de 'superadmin' seteada a 'MiClaveSuperSegura123'."

#######################################
# 5) Restart backend (para que tome bien todo)
#######################################
echo
echo "🔁 Reiniciando backend de STAGING..."
docker restart drizatx-stg-backend >/dev/null

echo
echo "🏁 LISTO: STAGING sincronizado desde Railway."
echo "   - Dump usado: ${BACKUP_FILE}"
echo "   - Podés probar en: http://77.42.23.51:3110"
