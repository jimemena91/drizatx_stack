# Runbook — Deploy y Rollback de Martínez

## Objetivo
Este documento define el procedimiento correcto para desplegar cambios en Martínez y cómo volver atrás de forma segura si un deploy falla o introduce regresiones.

---

## 1. Contexto del entorno Martínez

- Rama productiva: `martinez/prod`
- Worktree VPS productivo: `/opt/drizatx_worktrees/martinez-prod`
- Workflow oficial de deploy: `.github/workflows/deploy-martinez.yml`
- Compose productivo real: `docker-compose.martinez.yml`
- Backend container real: `drizatx-martinez-backend`
- Frontend container real: `drizatx-martinez-frontend`
- MySQL real: `drizatx-martinez-mysql`
- Base de datos real: `drizatx_martinez`
- Backend host port real: `3201`
- Frontend host port real: `3210`
- Healthcheck backend real: `http://127.0.0.1:3201/api/health`

### Importante
- La producción real de Martínez usa `docker-compose.martinez.yml` y la base `drizatx_martinez`.
- El backend real de Martínez conecta contra:
  - `DATABASE_HOST=drizatx-martinez-mysql`
  - `DATABASE_NAME=drizatx_martinez`
- El archivo `docker-compose.yml` no debe usarse para el deploy productivo real de Martínez.
- El workflow legacy `deploy-vps.yml` quedó desactivado para evitar duplicidad de deploys.
- El worktree `/opt/drizatx_worktrees/martinez-prod` debe permanecer siempre en la rama `martinez/prod`.
- No usar este worktree productivo para ramas `feature/`, `fix/` o `docs/`.

---

## 2. Flujo correcto de deploy

### 2.1. Desarrollo
1. Crear una rama de trabajo desde `martinez/prod` en un worktree o clon separado.
2. Realizar cambios.
3. Verificar `git status`.
4. Commit de los cambios.
5. Push de la rama.
6. Crear PR hacia `martinez/prod`.
7. Revisar y mergear.

### 2.2. Deploy automático
El workflow `deploy-martinez.yml` se ejecuta cuando hay push a `martinez/prod`.

### 2.3. Qué hace el workflow
1. Entra a `/opt/drizatx_worktrees/martinez-prod`
2. Ejecuta:
   - `git fetch origin`
   - `git pull --ff-only origin martinez/prod`
3. Baja contenedores previos de Martínez si existen:
   - `sudo docker rm -f drizatx-martinez-backend || true`
   - `sudo docker rm -f drizatx-martinez-frontend || true`
4. Ejecuta:
   - `docker compose -f docker-compose.martinez.yml up -d --build`
5. Espera backend
6. Ejecuta healthcheck en:
   - `http://127.0.0.1:3201/api/health`
7. Si falla, muestra:
   - `docker compose ps`
   - logs del backend real
   - logs del frontend real

---

## 3. Validaciones post deploy

### 3.1. En VPS
```bash
cd /opt/drizatx_worktrees/martinez-prod
docker compose -f docker-compose.martinez.yml ps
curl -fsS http://127.0.0.1:3201/api/health
docker logs --tail 200 drizatx-martinez-backend
docker logs --tail 200 drizatx-martinez-frontend
