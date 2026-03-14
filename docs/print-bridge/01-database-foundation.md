# Print Bridge - Paso 1: Base de datos

## Objetivo

Crear la base de persistencia del nuevo sistema de impresión de DrizaTx para soportar un Print Bridge robusto, desacoplado del túnel SSH y preparado para escalar a múltiples clientes.

## Entorno de trabajo

- Rama: `staging`
- Backend: `/opt/drizatx_worktrees/staging/backend`
- Base de datos validada: staging real sobre MySQL en contenedor `drizatx-stg-mysql`

## Migración creada

Archivo:

`backend/src/migrations/1781000000000-AddPrintSystem.ts`

Commit asociado:

`8ca8a97` — `feat(print): add print system foundation tables`

## Tablas creadas

### 1. `print_bridges`

Representa una instalación local del bridge de impresión en una PC o sucursal.

Campos principales:

- `id`
- `client_id`
- `branch_id`
- `name`
- `secret_token`
- `status`
- `last_seen_at`
- `printer_name`
- `app_version`
- `local_ip`
- `created_at`
- `updated_at`

### 2. `print_jobs`

Representa cada trabajo de impresión generado por el sistema.

Campos principales:

- `id`
- `client_id`
- `branch_id`
- `bridge_id`
- `source_type`
- `source_reference`
- `status`
- `payload_json`
- `error_message`
- `attempts`
- `sent_at`
- `acked_at`
- `printed_at`
- `failed_at`
- `created_at`
- `updated_at`

### 3. `print_job_events`

Permite auditar el historial de eventos de cada trabajo de impresión.

Campos principales:

- `id`
- `print_job_id`
- `event_type`
- `event_payload`
- `created_at`

## Decisiones de diseño

### Sin foreign keys en esta etapa

No se agregaron claves foráneas todavía porque primero se priorizó dejar una base funcional y estable sin asumir relaciones incorrectas con el modelo actual de clientes/sucursales.

Esto permite avanzar sin romper staging y deja la puerta abierta a refinar el modelo en una etapa posterior.

### Uso de `payload_json`

Se eligió JSON para soportar distintos formatos de ticket sin rigidizar el esquema demasiado pronto.

Esto hace al sistema más flexible y mantenible.

### Índices desde el inicio

Se agregaron índices en consultas esperadas de alto uso:

- jobs por sucursal y estado
- jobs por fecha
- jobs por bridge
- eventos por job

Esto mejora escalabilidad desde la base.

## Cómo se ejecutó en staging

La migración no se pudo correr directamente desde el host al principio por dos motivos:

1. el worktree `staging/backend` no tenía `node_modules`
2. el backend depende de variables de entorno de Docker (`DATABASE_HOST=db`, etc.)

Además, el MySQL real de staging ya existía en el proyecto compose `drizatx_stack`, usando:

- contenedor: `drizatx-stg-mysql`
- red: `drizatx_stack_default`

### Comando utilizado

```bash
docker run --rm \
  --network drizatx_stack_default \
  -v /opt/drizatx_worktrees/staging/backend:/app \
  -w /app \
  -e DATABASE_HOST=drizatx-stg-mysql \
  -e DATABASE_PORT=3306 \
  -e DATABASE_USERNAME=driza \
  -e DATABASE_PASSWORD='DrizaDB_2025' \
  -e DATABASE_NAME=drizatx \
  node:20-bullseye \
  bash -lc "npm install && npm run migration:run"
