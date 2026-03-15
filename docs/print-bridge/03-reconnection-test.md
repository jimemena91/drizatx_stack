# Print Bridge - Paso 3: Prueba de reconexión WebSocket

## Objetivo

Validar que un bridge cliente conectado por WebSocket al backend de DrizaTx pueda:

- conectarse correctamente
- registrarse
- enviar heartbeat
- detectar desconexión
- reintentar automáticamente
- reconectar solo cuando el backend vuelve

## Entorno usado

### Backend temporal
- VPS: `77.42.23.51`
- Puerto publicado: `3301`
- Contenedor temporal: `print-backend-test`

### Cliente de prueba
- Windows
- Carpeta: `C:\print-bridge-test`

## Commit asociado

`f859e25` — `test(print): add websocket bridge reconnection probe`

## Archivos creados

Dentro de:

`tools/print-bridge-test`

- `package.json`
- `index.js`

## Dependencia usada

- `socket.io-client`

## Flujo validado

El cliente bridge realiza:

1. conexión al backend WebSocket
2. evento `print:hello`
3. heartbeat cada 10 segundos
4. consulta de bridges conectados cada 15 segundos

## Comando del backend temporal

```bash
docker rm -f print-backend-test
docker run --rm \
  --name print-backend-test \
  --network drizatx_stack_default \
  -p 3301:3000 \
  -v /opt/drizatx_worktrees/staging/backend:/app \
  -w /app \
  -e DATABASE_HOST=drizatx-stg-mysql \
  -e DATABASE_PORT=3306 \
  -e DATABASE_USERNAME=driza \
  -e DATABASE_PASSWORD='DrizaDB_2025' \
  -e DATABASE_NAME=drizatx \
  -e JWT_SECRET='staging-print-bridge-test-secret' \
  node:20-bullseye \
  bash -lc "npm install && npm run start:dev"
