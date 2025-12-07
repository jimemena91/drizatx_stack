# scripts/db-test-init.ps1
# Inicializa la base de datos de pruebas en Windows PowerShell.
# Uso en PowerShell:
#   $env:DB_USER="root"; $env:DB_PASS="tu_password"; ./scripts/db-test-init.ps1

param(
  [string]$DbUser = $Env:DB_USER,
  [string]$DbPass = $Env:DB_PASS,
  [string]$DbHost = $Env:DB_HOST,
  [string]$DbPort = $Env:DB_PORT
)

if (-not $DbUser) { $DbUser = "root" }
if (-not $DbHost) { $DbHost = "localhost" }
if (-not $DbPort) { $DbPort = "3306" }

$passArg = ""
if ($DbPass) { $passArg = "-p$DbPass" }

Write-Host ">> Creando base de pruebas drizatx_test ..."
& mysql -h $DbHost -P $DbPort -u $DbUser $passArg < "backend/scripts/010-create-database-test.sql"

# Si tienes migraciones, puedes ejecutarlas aquí (ajusta el comando según tu proyecto):
# Push-Location backend
# $Env:ENV_FILE = ".env.test"
# npm run typeorm:migrate
# Pop-Location

if (Test-Path "backend/scripts/012-seed-test.sql") {
  Write-Host ">> Aplicando semilla 012-seed-test.sql ..."
  & mysql -h $DbHost -P $DbPort -u $DbUser $passArg drizatx_test < "backend/scripts/012-seed-test.sql"
}

Write-Host ">> Listo. Base de pruebas creada."
