#!/usr/bin/env bash

drizatx_load_client_config() {
  local client_key="${1:?Falta el identificador del cliente}"
  local config_file="$DRIZATX_DEPLOY_ROOT/clients/${client_key}.conf"

  [ -f "$config_file" ] ||
    drizatx_fail "No existe la configuración: $config_file"

  # Los archivos de configuración forman parte del repositorio y se revisan
  # antes de incorporarlos. No deben contener contraseñas ni tokens.
  # shellcheck source=/dev/null
  source "$config_file"

  DRIZATX_CLIENT_KEY="$client_key"
  DRIZATX_CLIENT_CONFIG="$config_file"
}

drizatx_validate_client_config() {
  local required_variables=(
    CLIENT_NAME
    EXPECTED_HOST
    WORKTREE
    BRANCH
    COMPOSE_PROJECT
    COMPOSE_FILE
    FRONTEND_SERVICE
    FRONTEND_CONTAINER
    BACKEND_CONTAINER
    DB_CONTAINER
    FRONTEND_IMAGE
    NETWORK
    FRONTEND_PORT
    BACKEND_PORT
    TEST_PORT
    PUBLIC_BASE_URL
    PUBLIC_API_URL
  )

  local variable_name

  for variable_name in "${required_variables[@]}"; do
    drizatx_require_variable "$variable_name"
  done

  drizatx_validate_port "$FRONTEND_PORT" "FRONTEND_PORT"
  drizatx_validate_port "$BACKEND_PORT" "BACKEND_PORT"
  drizatx_validate_port "$TEST_PORT" "TEST_PORT"

  [ "$FRONTEND_PORT" != "$BACKEND_PORT" ] ||
    drizatx_fail "FRONTEND_PORT y BACKEND_PORT no pueden coincidir"

  [ "$FRONTEND_PORT" != "$TEST_PORT" ] ||
    drizatx_fail "FRONTEND_PORT y TEST_PORT no pueden coincidir"

  [ "$BACKEND_PORT" != "$TEST_PORT" ] ||
    drizatx_fail "BACKEND_PORT y TEST_PORT no pueden coincidir"

  case "$PUBLIC_BASE_URL" in
    https://*)
      ;;
    *)
      drizatx_fail "PUBLIC_BASE_URL debe comenzar con https://"
      ;;
  esac

  case "$PUBLIC_API_URL" in
    https://*)
      ;;
    *)
      drizatx_fail "PUBLIC_API_URL debe comenzar con https://"
      ;;
  esac

  case "$COMPOSE_FILE" in
    "$WORKTREE"/*)
      ;;
    *)
      drizatx_fail "COMPOSE_FILE debe pertenecer al WORKTREE del cliente"
      ;;
  esac
}

drizatx_print_client_config() {
  cat <<CONFIG

Cliente:              $CLIENT_NAME
Clave:                $DRIZATX_CLIENT_KEY
Configuración:        $DRIZATX_CLIENT_CONFIG
Host esperado:        $EXPECTED_HOST
Worktree:             $WORKTREE
Rama:                 $BRANCH
Proyecto Compose:     $COMPOSE_PROJECT
Archivo Compose:      $COMPOSE_FILE
Servicio frontend:    $FRONTEND_SERVICE
Contenedor frontend:  $FRONTEND_CONTAINER
Contenedor backend:   $BACKEND_CONTAINER
Contenedor MySQL:     $DB_CONTAINER
Imagen frontend:      $FRONTEND_IMAGE
Red Docker:           $NETWORK
Puerto frontend:      $FRONTEND_PORT
Puerto backend:       $BACKEND_PORT
Puerto temporal:      $TEST_PORT
Aplicación pública:   $PUBLIC_BASE_URL
API pública:          $PUBLIC_API_URL

CONFIG
}
