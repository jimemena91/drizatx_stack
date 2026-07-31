#!/usr/bin/env bash

drizatx_container_running() {
  local container_name="${1:?Falta el nombre del contenedor}"

  [ "$(docker inspect \
    --format '{{.State.Running}}' \
    "$container_name" 2>/dev/null || true)" = "true" ]
}

drizatx_container_image_id() {
  local container_name="${1:?Falta el nombre del contenedor}"

  docker inspect \
    --format '{{.Image}}' \
    "$container_name"
}

drizatx_container_has_network() {
  local container_name="${1:?Falta el nombre del contenedor}"
  local network_name="${2:?Falta el nombre de la red}"

  docker inspect \
    --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' \
    "$container_name" |
  grep -Fxq "$network_name"
}

drizatx_published_host_ports() {
  local container_name="${1:?Falta el nombre del contenedor}"
  local container_port="${2:?Falta el puerto interno}"

  docker inspect \
    --format "{{range (index .NetworkSettings.Ports \"${container_port}/tcp\")}}{{println .HostPort}}{{end}}" \
    "$container_name" |
  awk 'NF { print $1 }' |
  sort -u
}

drizatx_validate_exact_port() {
  local container_name="${1:?Falta el contenedor}"
  local container_port="${2:?Falta el puerto interno}"
  local expected_host_port="${3:?Falta el puerto publicado esperado}"

  local ports

  ports="$(
    drizatx_published_host_ports \
      "$container_name" \
      "$container_port"
  )"

  [ "$ports" = "$expected_host_port" ] || {
    echo "Puertos encontrados para $container_name:"
    printf '%s\n' "${ports:-NINGUNO}"
    drizatx_fail \
      "El puerto publicado no coincide: esperado $expected_host_port -> $container_port"
  }
}

drizatx_validate_repository_clean() {
  local worktree="${1:?Falta el worktree}"

  git -C "$worktree" diff --quiet ||
    drizatx_fail "El repositorio tiene cambios locales"

  git -C "$worktree" diff --cached --quiet ||
    drizatx_fail "El repositorio tiene cambios preparados"

  [ -z "$(git -C "$worktree" status --short)" ] ||
    drizatx_fail "El repositorio contiene archivos sin registrar"
}

drizatx_validate_read_only_environment() {
  drizatx_section "VALIDACIÓN DEL ENTORNO"

  [ "$(hostname)" = "$EXPECTED_HOST" ] ||
    drizatx_fail "Servidor inesperado: $(hostname)"

  [ -d "$WORKTREE" ] ||
    drizatx_fail "No existe el worktree: $WORKTREE"

  [ -d "$WORKTREE/.git" ] || [ -f "$WORKTREE/.git" ] ||
    drizatx_fail "El worktree no parece ser un repositorio Git"

  [ -f "$COMPOSE_FILE" ] ||
    drizatx_fail "No existe el archivo Compose: $COMPOSE_FILE"

  local current_branch
  current_branch="$(git -C "$WORKTREE" branch --show-current)"

  [ "$current_branch" = "$BRANCH" ] ||
    drizatx_fail "Rama inesperada: $current_branch"

  drizatx_validate_repository_clean "$WORKTREE"

  echo "Host correcto: $(hostname)"
  echo "Worktree correcto: $WORKTREE"
  echo "Rama correcta: $current_branch"
  echo "HEAD: $(git -C "$WORKTREE" rev-parse --short HEAD)"
  echo "Repositorio limpio."
  echo "Compose existente: $COMPOSE_FILE"
}

drizatx_validate_compose_configuration() {
  drizatx_section "VALIDACIÓN DE DOCKER COMPOSE"

  docker compose \
    -p "$COMPOSE_PROJECT" \
    -f "$COMPOSE_FILE" \
    config --quiet

  echo "Configuración Compose válida."
}

drizatx_validate_expected_containers() {
  drizatx_section "VALIDACIÓN DE CONTENEDORES"

  local container_name

  for container_name in \
    "$FRONTEND_CONTAINER" \
    "$BACKEND_CONTAINER" \
    "$DB_CONTAINER"
  do
    docker inspect "$container_name" >/dev/null 2>&1 ||
      drizatx_fail "No existe el contenedor: $container_name"

    drizatx_container_running "$container_name" ||
      drizatx_fail "El contenedor no está activo: $container_name"

    drizatx_container_has_network "$container_name" "$NETWORK" ||
      drizatx_fail \
        "El contenedor $container_name no pertenece a la red $NETWORK"

    docker inspect "$container_name" \
      --format 'Nombre={{.Name}} Estado={{.State.Status}} Running={{.State.Running}} Imagen={{.Image}}'
  done

  echo "Los tres contenedores están activos y aislados en la red esperada."
}

drizatx_validate_ports() {
  drizatx_section "VALIDACIÓN DE PUERTOS"

  drizatx_validate_exact_port \
    "$FRONTEND_CONTAINER" \
    "3000" \
    "$FRONTEND_PORT"

  drizatx_validate_exact_port \
    "$BACKEND_CONTAINER" \
    "3001" \
    "$BACKEND_PORT"

  local db_public_ports

  db_public_ports="$(
    docker inspect \
      --format '{{range $port, $bindings := .NetworkSettings.Ports}}{{if $bindings}}{{println $port}}{{end}}{{end}}' \
      "$DB_CONTAINER" |
    awk 'NF { print $1 }' |
    sort -u
  )"

  [ -z "$db_public_ports" ] || {
    echo "$db_public_ports"
    drizatx_fail "MySQL tiene puertos publicados hacia el host"
  }

  echo "Frontend: $FRONTEND_PORT -> 3000"
  echo "Backend:  $BACKEND_PORT -> 3001"
  echo "MySQL sin puerto público."
}

drizatx_validate_test_port_available() {
  drizatx_section "VALIDACIÓN DEL PUERTO TEMPORAL"

  if docker ps \
    --format '{{.Ports}}' |
    grep -Eq "(^|[.:])${TEST_PORT}->"; then
    drizatx_fail \
      "El puerto temporal $TEST_PORT ya está utilizado por Docker"
  fi

  if command -v ss >/dev/null 2>&1 &&
    ss -H -ltn |
    awk '{print $4}' |
    grep -Eq "[:.]${TEST_PORT}$"; then
    drizatx_fail \
      "El puerto temporal $TEST_PORT ya está ocupado en el host"
  fi

  echo "Puerto temporal disponible: $TEST_PORT"
}

drizatx_run_preflight() {
  drizatx_validate_read_only_environment
  drizatx_validate_compose_configuration
  drizatx_validate_expected_containers
  drizatx_validate_ports
  drizatx_validate_test_port_available
}
