#!/usr/bin/env bash

drizatx_prepare_cleanup_preview() {
  if [ -n "${DRIZATX_PREVIEW_CONTAINER:-}" ] &&
    docker inspect "$DRIZATX_PREVIEW_CONTAINER" >/dev/null 2>&1; then
    echo
    echo "Eliminando preview temporal: $DRIZATX_PREVIEW_CONTAINER"

    docker rm \
      --force \
      "$DRIZATX_PREVIEW_CONTAINER" \
      >/dev/null 2>&1 ||
      true
  fi

  if [ -n "${DRIZATX_PREVIEW_ENV_FILE:-}" ] &&
    [ -f "$DRIZATX_PREVIEW_ENV_FILE" ]; then
    rm -f "$DRIZATX_PREVIEW_ENV_FILE"
  fi
}

drizatx_prepare_image_repository() {
  local configured_image="${1:?Falta la imagen configurada}"

  case "$configured_image" in
    *:*)
      printf '%s\n' "${configured_image%:*}"
      ;;
    *)
      printf '%s\n' "$configured_image"
      ;;
  esac
}

drizatx_prepare_validate_disk_space() {
  local path="${1:?Falta la ruta}"
  local minimum_kb="${2:?Falta el mínimo de espacio}"

  local available_kb

  available_kb="$(
    df --output=avail "$path" |
    awk 'NR == 2 { print $1 }'
  )"

  [[ "$available_kb" =~ ^[0-9]+$ ]] ||
    drizatx_fail \
      "No se pudo determinar el espacio disponible en $path"

  [ "$available_kb" -ge "$minimum_kb" ] ||
    drizatx_fail \
      "Espacio insuficiente en $path: ${available_kb} KB disponibles"

  echo "Espacio disponible validado: ${available_kb} KB"
}

drizatx_prepare_wait_for_http() {
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
            drizatx_fail \
              "El preview respondió con tipo inesperado: $content_type"
            ;;
        esac

        DRIZATX_PREVIEW_HTTP_CODE="$http_code"
        DRIZATX_PREVIEW_CONTENT_TYPE="$content_type"
        DRIZATX_PREVIEW_FINAL_URL="$final_url"

        export \
          DRIZATX_PREVIEW_HTTP_CODE \
          DRIZATX_PREVIEW_CONTENT_TYPE \
          DRIZATX_PREVIEW_FINAL_URL

        return 0
        ;;
    esac

    echo \
      "Esperando preview HTTP ($attempt/$attempts): código ${http_code:-SIN_RESPUESTA}"

    sleep "$delay_seconds"
  done

  return 1
}

drizatx_prepare_frontend() {
  local prepared_at
  local source_head
  local source_short_head
  local image_repository
  local prepared_tag
  local prepared_image
  local active_image_id
  local built_image_id
  local active_image_id_after
  local backup_root
  local preparation_dir
  local manifest_file
  local preview_url
  local preview_container
  local preview_env_file

  prepared_at="$(date -u +%Y%m%dT%H%M%SZ)"
  source_head="$(git -C "$WORKTREE" rev-parse HEAD)"
  source_short_head="$(git -C "$WORKTREE" rev-parse --short HEAD)"

  image_repository="$(
    drizatx_prepare_image_repository "$FRONTEND_IMAGE"
  )"

  prepared_tag="prepare-${prepared_at,,}-${source_short_head}"
  prepared_image="${image_repository}:${prepared_tag}"

  backup_root="/opt/drizatx_backups/${DRIZATX_CLIENT_KEY}/deploy"
  preparation_dir="${backup_root}/prepare-${prepared_at}-${source_short_head}"
  manifest_file="${preparation_dir}/manifest.env"

  preview_container="drizatx-preview-${DRIZATX_CLIENT_KEY}-${source_short_head}-${prepared_at,,}"
  preview_env_file="${preparation_dir}/frontend-preview.env"
  preview_url="http://127.0.0.1:${TEST_PORT}/"

  DRIZATX_PREVIEW_CONTAINER="$preview_container"
  DRIZATX_PREVIEW_ENV_FILE="$preview_env_file"

  export \
    DRIZATX_PREVIEW_CONTAINER \
    DRIZATX_PREVIEW_ENV_FILE

  trap drizatx_prepare_cleanup_preview EXIT INT TERM

  drizatx_section "PREPARE — PREFLIGHT"

  drizatx_run_preflight

  drizatx_section "PREPARE — ESPACIO DISPONIBLE"

  drizatx_prepare_validate_disk_space \
    /var/lib/docker \
    10485760

  drizatx_prepare_validate_disk_space \
    /opt/drizatx_backups \
    1048576

  drizatx_section "PREPARE — BACKUP DE ESTADO"

  mkdir -p "$preparation_dir"
  chmod 700 "$preparation_dir"

  active_image_id="$(
    drizatx_container_image_id "$FRONTEND_CONTAINER"
  )"

  [ -n "$active_image_id" ] ||
    drizatx_fail \
      "No se pudo identificar la imagen activa del frontend"

  docker inspect \
    "$FRONTEND_CONTAINER" \
    >"${preparation_dir}/frontend-container-before.json"

  docker image inspect \
    "$active_image_id" \
    >"${preparation_dir}/frontend-image-before.json"

  cp -a \
    "$COMPOSE_FILE" \
    "${preparation_dir}/$(basename "$COMPOSE_FILE").before"

  cp -a \
    "$DRIZATX_CLIENT_CONFIG" \
    "${preparation_dir}/$(basename "$DRIZATX_CLIENT_CONFIG").before"

  git -C "$WORKTREE" rev-parse HEAD \
    >"${preparation_dir}/source-head.txt"

  git -C "$WORKTREE" status --short \
    >"${preparation_dir}/source-status.txt"

  docker inspect \
    --format '{{range .Config.Env}}{{println .}}{{end}}' \
    "$FRONTEND_CONTAINER" \
    >"$preview_env_file"

  chmod 600 "$preview_env_file"

  cat >"$manifest_file" <<MANIFEST
PREPARE_STATUS="STARTED"
CLIENT_KEY="$DRIZATX_CLIENT_KEY"
CLIENT_NAME="$CLIENT_NAME"
PREPARED_AT="$prepared_at"
SOURCE_HEAD="$source_head"
SOURCE_SHORT_HEAD="$source_short_head"
ACTIVE_CONTAINER="$FRONTEND_CONTAINER"
ACTIVE_IMAGE_ID_BEFORE="$active_image_id"
CONFIGURED_IMAGE="$FRONTEND_IMAGE"
PREPARED_IMAGE="$prepared_image"
PREVIEW_CONTAINER="$preview_container"
PREVIEW_PORT="$TEST_PORT"
PREVIEW_URL="$preview_url"
MANIFEST

  chmod 600 "$manifest_file"

  echo "Directorio de preparación:"
  echo "$preparation_dir"
  echo
  echo "Imagen activa protegida:"
  echo "$active_image_id"

  drizatx_section "PREPARE — BUILD FRONTEND"

  docker compose \
    -p "$COMPOSE_PROJECT" \
    -f "$COMPOSE_FILE" \
    build \
    "$FRONTEND_SERVICE"

  built_image_id="$(
    docker image inspect \
      "$FRONTEND_IMAGE" \
      --format '{{.Id}}'
  )"

  [ -n "$built_image_id" ] ||
    drizatx_fail \
      "No se pudo identificar la imagen recién construida"

  docker image tag \
    "$built_image_id" \
    "$prepared_image"

  docker image tag \
    "$active_image_id" \
    "$FRONTEND_IMAGE"

  active_image_id_after="$(
    drizatx_container_image_id "$FRONTEND_CONTAINER"
  )"

  [ "$active_image_id_after" = "$active_image_id" ] ||
    drizatx_fail \
      "La imagen del contenedor productivo cambió durante prepare"

  [ "$(
    docker image inspect \
      "$FRONTEND_IMAGE" \
      --format '{{.Id}}'
  )" = "$active_image_id" ] ||
    drizatx_fail \
      "No se restauró correctamente la etiqueta productiva"

  [ "$(
    docker image inspect \
      "$prepared_image" \
      --format '{{.Id}}'
  )" = "$built_image_id" ] ||
    drizatx_fail \
      "La imagen versionada no coincide con el build"

  echo "Imagen construida:"
  echo "$built_image_id"
  echo
  echo "Imagen versionada:"
  echo "$prepared_image"
  echo
  echo "La etiqueta productiva fue restaurada a:"
  echo "$active_image_id"

  drizatx_section "PREPARE — PREVIEW TEMPORAL"

  docker run \
    --detach \
    --name "$preview_container" \
    --network "$NETWORK" \
    --publish "127.0.0.1:${TEST_PORT}:3000" \
    --env-file "$preview_env_file" \
    "$prepared_image" \
    >/dev/null

  drizatx_container_running "$preview_container" ||
    drizatx_fail \
      "El contenedor preview no quedó activo"

  echo "Preview temporal activo:"
  echo "$preview_container"
  echo
  echo "URL local:"
  echo "$preview_url"

  drizatx_section "PREPARE — VALIDACIÓN HTTP"

  if ! drizatx_prepare_wait_for_http \
    "$preview_url" \
    45 \
    2; then
    echo
    echo "Últimas líneas del preview:"
    docker logs --tail 120 "$preview_container" || true

    drizatx_fail \
      "El preview no superó la validación HTTP"
  fi

  echo "HTTP:         $DRIZATX_PREVIEW_HTTP_CODE"
  echo "Tipo:         $DRIZATX_PREVIEW_CONTENT_TYPE"
  echo "URL final:    $DRIZATX_PREVIEW_FINAL_URL"

  docker inspect \
    "$preview_container" \
    >"${preparation_dir}/preview-container.json"

  docker logs \
    "$preview_container" \
    >"${preparation_dir}/preview.log" 2>&1 ||
    true

  cat >>"$manifest_file" <<MANIFEST
BUILT_IMAGE_ID="$built_image_id"
ACTIVE_IMAGE_ID_AFTER="$active_image_id_after"
PREVIEW_HTTP_CODE="$DRIZATX_PREVIEW_HTTP_CODE"
PREVIEW_CONTENT_TYPE="$DRIZATX_PREVIEW_CONTENT_TYPE"
PREVIEW_FINAL_URL="$DRIZATX_PREVIEW_FINAL_URL"
PREPARE_STATUS="SUCCESS"
MANIFEST

  sha256sum \
    "$manifest_file" \
    >"${manifest_file}.sha256"

  rm -f "$preview_env_file"
  DRIZATX_PREVIEW_ENV_FILE=""

  drizatx_prepare_cleanup_preview
  DRIZATX_PREVIEW_CONTAINER=""

  trap - EXIT INT TERM

  drizatx_section "PREPARE — RESULTADO"

  echo "Preparación terminada correctamente."
  echo
  echo "Cliente:"
  echo "$CLIENT_NAME"
  echo
  echo "Commit preparado:"
  echo "$source_head"
  echo
  echo "Imagen validada:"
  echo "$prepared_image"
  echo
  echo "Manifest:"
  echo "$manifest_file"
  echo
  echo "Producción no fue reemplazada."
  echo "El contenedor frontend productivo no fue recreado."
  echo "El backend y la base de datos no fueron modificados."
  echo "El preview temporal fue eliminado."
}
