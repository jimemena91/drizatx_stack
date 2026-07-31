#!/usr/bin/env bash

drizatx_validate_read_only_environment() {
  drizatx_section "VALIDACIÓN DE SOLO LECTURA"

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

  echo "Host correcto: $(hostname)"
  echo "Worktree existente: $WORKTREE"
  echo "Rama correcta: $current_branch"
  echo "HEAD: $(git -C "$WORKTREE" rev-parse --short HEAD)"
  echo "Compose existente: $COMPOSE_FILE"
}

drizatx_validate_expected_containers() {
  drizatx_section "CONTENEDORES CONFIGURADOS"

  local container_name

  for container_name in \
    "$FRONTEND_CONTAINER" \
    "$BACKEND_CONTAINER" \
    "$DB_CONTAINER"
  do
    if docker inspect "$container_name" >/dev/null 2>&1; then
      docker inspect "$container_name" \
        --format 'Nombre={{.Name}} Estado={{.State.Status}} Running={{.State.Running}} Imagen={{.Image}}'
    else
      echo "AUSENTE: $container_name"
    fi
  done
}
