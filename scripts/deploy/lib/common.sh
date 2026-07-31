#!/usr/bin/env bash

drizatx_fail() {
  echo
  echo "SEGURIDAD: $*" >&2
  exit 1
}

drizatx_section() {
  echo
  echo "=================================================="
  echo "$1"
  echo "=================================================="
}

drizatx_require_command() {
  local command_name="${1:?Falta el nombre del comando}"

  command -v "$command_name" >/dev/null 2>&1 ||
    drizatx_fail "No está disponible el comando requerido: $command_name"
}

drizatx_require_variable() {
  local variable_name="${1:?Falta el nombre de la variable}"
  local variable_value="${!variable_name:-}"

  [ -n "$variable_value" ] ||
    drizatx_fail "La configuración no define: $variable_name"
}

drizatx_validate_port() {
  local port="${1:?Falta el puerto}"
  local label="${2:-puerto}"

  [[ "$port" =~ ^[0-9]+$ ]] ||
    drizatx_fail "$label no es numérico: $port"

  [ "$port" -ge 1 ] && [ "$port" -le 65535 ] ||
    drizatx_fail "$label está fuera de rango: $port"
}
