#!/usr/bin/env bash

drizatx_deploy_manifest_value() {
  local manifest_file="${1:?Falta el manifest}"
  local variable_name="${2:?Falta la variable}"

  sed -n \
    "s/^${variable_name}=\"\\(.*\\)\"$/\\1/p" \
    "$manifest_file" |
  tail -n 1
}

drizatx_deploy_validate_manifest_path() {
  local manifest_file="${1:?Falta el manifest}"

  [ -f "$manifest_file" ] ||
    drizatx_fail "No existe el manifest: $manifest_file"

  [ "$(basename "$manifest_file")" = "manifest.env" ] ||
    drizatx_fail "El archivo debe llamarse manifest.env"

  case "$manifest_file" in
    "/opt/drizatx_backups/${DRIZATX_CLIENT_KEY}/deploy/"*/manifest.env)
      ;;
    *)
      drizatx_fail \
        "El manifest no pertenece al cliente $DRIZATX_CLIENT_KEY"
      ;;
  esac

  [ -f "${manifest_file}.sha256" ] ||
    drizatx_fail \
      "No existe el checksum del manifest"

  (
    cd "$(dirname "$manifest_file")"
    sha256sum \
      --check \
      "$(basename "${manifest_file}.sha256")"
  )
}

drizatx_deploy_wait_for_http() {
  local url="${1:?Falta la URL}"
  local attempts="${2:-45}"
  local delay_seconds="${3:-2}"

  local attempt
  local http_code
  local content_type
  local final_url

  for attempt in $(seq 1 "$attempts"); do
    http_code="$(
      curl \
        --silent \
        --show-error \
        --location \
        --output /dev/null \
        --connect-timeout 3 \
        --max-time 10 \
        --write-out '%{http_code}' \
        "$url" 2>/dev/null ||
      true
    )"

    case "$http_code" in
      2??|3??)
        content_type="$(
          curl \
            --silent \
            --show-error \
            --location \
            --output /dev/null \
            --connect-timeout 3 \
            --max-time 10 \
            --write-out '%{content_type}' \
            "$url"
        )"

        final_url="$(
          curl \
            --silent \
            --show-error \
            --location \
            --output /dev/null \
            --connect-timeout 3 \
            --max-time 10 \
            --write-out '%{url_effective}' \
            "$url"
        )"

        case "$content_type" in
          text/html*)
            ;;
          *)
            return 1
            ;;
        esac

        DRIZATX_DEPLOY_HTTP_CODE="$http_code"
        DRIZATX_DEPLOY_CONTENT_TYPE="$content_type"
        DRIZATX_DEPLOY_FINAL_URL="$final_url"

        export \
          DRIZATX_DEPLOY_HTTP_CODE \
          DRIZATX_DEPLOY_CONTENT_TYPE \
          DRIZATX_DEPLOY_FINAL_URL

        return 0
        ;;
    esac

    echo \
      "Esperando frontend HTTP ($attempt/$attempts): ${http_code:-SIN_RESPUESTA}"

    sleep "$delay_seconds"
  done

  return 1
}

drizatx_deploy_recreate_frontend() {
  docker compose \
    -p "$COMPOSE_PROJECT" \
    -f "$COMPOSE_FILE" \
    up \
    --detach \
    --no-deps \
    --force-recreate \
    "$FRONTEND_SERVICE"
}

drizatx_deploy_restore_image_tag() {
  local image_id="${1:?Falta la imagen}"

  docker image tag \
    "$image_id" \
    "$FRONTEND_IMAGE"
}

drizatx_deploy_rollback_frontend() {
  local rollback_image_id="${1:?Falta la imagen de rollback}"
  local deploy_record="${2:?Falta el registro de deploy}"

  echo
  echo "=================================================="
  echo "ROLLBACK AUTOMÁTICO"
  echo "=================================================="

  echo "Restaurando etiqueta productiva:"
  echo "$rollback_image_id"

  drizatx_deploy_restore_image_tag \
    "$rollback_image_id"

  drizatx_deploy_recreate_frontend

  if ! drizatx_deploy_wait_for_http \
    "http://127.0.0.1:${FRONTEND_PORT}/" \
    45 \
    2; then
    docker logs \
      --tail 150 \
      "$FRONTEND_CONTAINER" ||
      true

    cat >>"$deploy_record" <<ROLLBACK
ROLLBACK_STATUS="FAILED"
ROLLBACK_FINISHED_AT="$(date -u +%Y%m%dT%H%M%SZ)"
ROLLBACK

    drizatx_fail \
      "El rollback automático también falló"
  fi

  cat >>"$deploy_record" <<ROLLBACK
ROLLBACK_STATUS="SUCCESS"
ROLLBACK_FINISHED_AT="$(date -u +%Y%m%dT%H%M%SZ)"
ROLLBACK_HTTP_CODE="$DRIZATX_DEPLOY_HTTP_CODE"
ROLLBACK_FINAL_URL="$DRIZATX_DEPLOY_FINAL_URL"
ROLLBACK

  echo "Rollback automático completado."
  echo "HTTP: $DRIZATX_DEPLOY_HTTP_CODE"
}

drizatx_deploy_frontend() {
  local manifest_file="${1:?Falta el manifest}"

  local deploy_started_at
  local deploy_dir
  local deploy_record

  local manifest_status
  local manifest_client
  local source_head
  local current_source_head
  local prepared_image
  local built_image_id
  local active_image_before
  local current_active_image
  local configured_image

  local container_id_before
  local backend_id_before
  local db_id_before
  local backend_started_before
  local db_started_before

  local container_id_after
  local deployed_image_id
  local latest_image_id

  deploy_started_at="$(date -u +%Y%m%dT%H%M%SZ)"

  drizatx_section "DEPLOY — PREFLIGHT"

  drizatx_run_preflight

  drizatx_section "DEPLOY — VALIDAR MANIFEST"

  drizatx_deploy_validate_manifest_path \
    "$manifest_file"

  manifest_status="$(
    drizatx_deploy_manifest_value \
      "$manifest_file" \
      PREPARE_STATUS
  )"

  manifest_client="$(
    drizatx_deploy_manifest_value \
      "$manifest_file" \
      CLIENT_KEY
  )"

  source_head="$(
    drizatx_deploy_manifest_value \
      "$manifest_file" \
      SOURCE_HEAD
  )"

  prepared_image="$(
    drizatx_deploy_manifest_value \
      "$manifest_file" \
      PREPARED_IMAGE
  )"

  built_image_id="$(
    drizatx_deploy_manifest_value \
      "$manifest_file" \
      BUILT_IMAGE_ID
  )"

  active_image_before="$(
    drizatx_deploy_manifest_value \
      "$manifest_file" \
      ACTIVE_IMAGE_ID_BEFORE
  )"

  configured_image="$(
    drizatx_deploy_manifest_value \
      "$manifest_file" \
      CONFIGURED_IMAGE
  )"

  [ "$manifest_status" = "SUCCESS" ] ||
    drizatx_fail \
      "El prepare no terminó en SUCCESS"

  [ "$manifest_client" = "$DRIZATX_CLIENT_KEY" ] ||
    drizatx_fail \
      "El manifest pertenece a otro cliente"

  [ "$configured_image" = "$FRONTEND_IMAGE" ] ||
    drizatx_fail \
      "La imagen configurada cambió desde prepare"

  [ -n "$source_head" ] ||
    drizatx_fail \
      "El manifest no contiene SOURCE_HEAD"

  [ -n "$prepared_image" ] ||
    drizatx_fail \
      "El manifest no contiene PREPARED_IMAGE"

  [ -n "$built_image_id" ] ||
    drizatx_fail \
      "El manifest no contiene BUILT_IMAGE_ID"

  [ -n "$active_image_before" ] ||
    drizatx_fail \
      "El manifest no contiene ACTIVE_IMAGE_ID_BEFORE"

  current_source_head="$(
    git -C "$WORKTREE" rev-parse HEAD
  )"

  [ "$current_source_head" = "$source_head" ] ||
    drizatx_fail \
      "El HEAD actual no coincide con el preparado"

  docker image inspect \
    "$prepared_image" \
    >/dev/null 2>&1 ||
    drizatx_fail \
      "No existe la imagen preparada: $prepared_image"

  [ "$(
    docker image inspect \
      "$prepared_image" \
      --format '{{.Id}}'
  )" = "$built_image_id" ] ||
    drizatx_fail \
      "La imagen preparada no coincide con el manifest"

  current_active_image="$(
    drizatx_container_image_id \
      "$FRONTEND_CONTAINER"
  )"

  [ "$current_active_image" = "$active_image_before" ] ||
    drizatx_fail \
      "Producción cambió desde que se ejecutó prepare"

  echo "Manifest válido."
  echo "Cliente: $manifest_client"
  echo "Commit: $source_head"
  echo "Imagen preparada: $prepared_image"
  echo "Imagen preparada ID: $built_image_id"
  echo "Imagen activa actual: $current_active_image"

  drizatx_section "DEPLOY — PROTEGER ESTADO PRODUCTIVO"

  deploy_dir="$(
    dirname "$manifest_file"
  )/deploy-${deploy_started_at}"

  deploy_record="${deploy_dir}/deploy.env"

  mkdir -p "$deploy_dir"
  chmod 700 "$deploy_dir"

  docker inspect \
    "$FRONTEND_CONTAINER" \
    >"${deploy_dir}/frontend-before.json"

  docker inspect \
    "$BACKEND_CONTAINER" \
    >"${deploy_dir}/backend-before.json"

  docker inspect \
    "$DB_CONTAINER" \
    >"${deploy_dir}/database-before.json"

  cp -a \
    "$manifest_file" \
    "${deploy_dir}/prepare-manifest.env"

  cp -a \
    "${manifest_file}.sha256" \
    "${deploy_dir}/prepare-manifest.env.sha256"

  container_id_before="$(
    docker inspect \
      --format '{{.Id}}' \
      "$FRONTEND_CONTAINER"
  )"

  backend_id_before="$(
    docker inspect \
      --format '{{.Id}}' \
      "$BACKEND_CONTAINER"
  )"

  db_id_before="$(
    docker inspect \
      --format '{{.Id}}' \
      "$DB_CONTAINER"
  )"

  backend_started_before="$(
    docker inspect \
      --format '{{.State.StartedAt}}' \
      "$BACKEND_CONTAINER"
  )"

  db_started_before="$(
    docker inspect \
      --format '{{.State.StartedAt}}' \
      "$DB_CONTAINER"
  )"

  cat >"$deploy_record" <<RECORD
DEPLOY_STATUS="STARTED"
DEPLOY_STARTED_AT="$deploy_started_at"
CLIENT_KEY="$DRIZATX_CLIENT_KEY"
SOURCE_HEAD="$source_head"
PREPARED_IMAGE="$prepared_image"
PREPARED_IMAGE_ID="$built_image_id"
ROLLBACK_IMAGE_ID="$current_active_image"
FRONTEND_CONTAINER_ID_BEFORE="$container_id_before"
BACKEND_CONTAINER_ID_BEFORE="$backend_id_before"
DB_CONTAINER_ID_BEFORE="$db_id_before"
RECORD

  chmod 600 "$deploy_record"

  echo "Registro del despliegue:"
  echo "$deploy_record"

  drizatx_section "DEPLOY — ACTIVAR IMAGEN VALIDADA"

  docker image tag \
    "$prepared_image" \
    "$FRONTEND_IMAGE"

  latest_image_id="$(
    docker image inspect \
      "$FRONTEND_IMAGE" \
      --format '{{.Id}}'
  )"

  [ "$latest_image_id" = "$built_image_id" ] ||
    drizatx_fail \
      "La etiqueta productiva no apunta a la imagen preparada"

  if ! drizatx_deploy_recreate_frontend; then
    cat >>"$deploy_record" <<RECORD
DEPLOY_STATUS="RECREATE_FAILED"
DEPLOY_FAILED_AT="$(date -u +%Y%m%dT%H%M%SZ)"
RECORD

    drizatx_deploy_rollback_frontend \
      "$current_active_image" \
      "$deploy_record"

    drizatx_fail \
      "Falló la recreación del frontend; rollback ejecutado"
  fi

  drizatx_section "DEPLOY — VALIDAR CONTENEDORES AISLADOS"

  [ "$(
    docker inspect \
      --format '{{.Id}}' \
      "$BACKEND_CONTAINER"
  )" = "$backend_id_before" ] ||
    drizatx_fail \
      "El backend fue recreado inesperadamente"

  [ "$(
    docker inspect \
      --format '{{.Id}}' \
      "$DB_CONTAINER"
  )" = "$db_id_before" ] ||
    drizatx_fail \
      "MySQL fue recreado inesperadamente"

  [ "$(
    docker inspect \
      --format '{{.State.StartedAt}}' \
      "$BACKEND_CONTAINER"
  )" = "$backend_started_before" ] ||
    drizatx_fail \
      "El backend fue reiniciado inesperadamente"

  [ "$(
    docker inspect \
      --format '{{.State.StartedAt}}' \
      "$DB_CONTAINER"
  )" = "$db_started_before" ] ||
    drizatx_fail \
      "MySQL fue reiniciado inesperadamente"

  container_id_after="$(
    docker inspect \
      --format '{{.Id}}' \
      "$FRONTEND_CONTAINER"
  )"

  [ "$container_id_after" != "$container_id_before" ] ||
    drizatx_fail \
      "El frontend no fue recreado"

  deployed_image_id="$(
    drizatx_container_image_id \
      "$FRONTEND_CONTAINER"
  )"

  [ "$deployed_image_id" = "$built_image_id" ] || {
    cat >>"$deploy_record" <<RECORD
DEPLOY_STATUS="IMAGE_MISMATCH"
DEPLOY_FAILED_AT="$(date -u +%Y%m%dT%H%M%SZ)"
ACTUAL_IMAGE_ID="$deployed_image_id"
RECORD

    drizatx_deploy_rollback_frontend \
      "$current_active_image" \
      "$deploy_record"

    drizatx_fail \
      "El contenedor no usa la imagen preparada; rollback ejecutado"
  }

  echo "Solo el frontend fue recreado."
  echo "Backend conservado."
  echo "MySQL conservado."
  echo "Imagen activa: $deployed_image_id"

  drizatx_section "DEPLOY — VALIDACIÓN HTTP"

  if ! drizatx_deploy_wait_for_http \
    "http://127.0.0.1:${FRONTEND_PORT}/" \
    45 \
    2; then
    docker logs \
      --tail 150 \
      "$FRONTEND_CONTAINER" \
      >"${deploy_dir}/frontend-failed.log" 2>&1 ||
      true

    cat >>"$deploy_record" <<RECORD
DEPLOY_STATUS="HTTP_FAILED"
DEPLOY_FAILED_AT="$(date -u +%Y%m%dT%H%M%SZ)"
RECORD

    drizatx_deploy_rollback_frontend \
      "$current_active_image" \
      "$deploy_record"

    drizatx_fail \
      "La validación HTTP falló; rollback ejecutado"
  fi

  docker inspect \
    "$FRONTEND_CONTAINER" \
    >"${deploy_dir}/frontend-after.json"

  docker logs \
    "$FRONTEND_CONTAINER" \
    >"${deploy_dir}/frontend-after.log" 2>&1 ||
    true

  cat >>"$deploy_record" <<RECORD
DEPLOY_STATUS="SUCCESS"
DEPLOY_FINISHED_AT="$(date -u +%Y%m%dT%H%M%SZ)"
FRONTEND_CONTAINER_ID_AFTER="$container_id_after"
DEPLOYED_IMAGE_ID="$deployed_image_id"
DEPLOY_HTTP_CODE="$DRIZATX_DEPLOY_HTTP_CODE"
DEPLOY_CONTENT_TYPE="$DRIZATX_DEPLOY_CONTENT_TYPE"
DEPLOY_FINAL_URL="$DRIZATX_DEPLOY_FINAL_URL"
RECORD

  sha256sum \
    "$deploy_record" \
    >"${deploy_record}.sha256"

  drizatx_section "DEPLOY — RESULTADO"

  echo "Despliegue terminado correctamente."
  echo
  echo "Cliente:"
  echo "$CLIENT_NAME"
  echo
  echo "Commit desplegado:"
  echo "$source_head"
  echo
  echo "Imagen desplegada:"
  echo "$prepared_image"
  echo
  echo "Imagen ID:"
  echo "$deployed_image_id"
  echo
  echo "HTTP:"
  echo "$DRIZATX_DEPLOY_HTTP_CODE"
  echo
  echo "URL final:"
  echo "$DRIZATX_DEPLOY_FINAL_URL"
  echo
  echo "Registro:"
  echo "$deploy_record"
  echo
  echo "Solo el frontend fue recreado."
  echo "El backend no fue recreado ni reiniciado."
  echo "MySQL no fue recreado ni reiniciado."
}
