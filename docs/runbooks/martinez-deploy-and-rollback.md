# Runbook — Deploy y Rollback de Martínez

## Objetivo
Este documento define el procedimiento correcto para desplegar cambios en Martínez y cómo volver atrás de forma segura si un deploy falla o introduce regresiones.

---

## 1. Contexto del entorno Martínez

- Rama productiva: `martinez/prod`
- Worktree VPS: `/opt/drizatx_worktrees/martinez-prod`
- Compose productivo real: `docker-compose.yml`
- Proyecto Docker Compose real: `martinez-prod`
- Backend container real: `martinez-prod-backend-1`
- Frontend container real: `martinez-prod-frontend-1`
- Backend host port real: `3001`
- Frontend host port real: `3010`
- Healthcheck backend real: `http://127.0.0.1:3001/api/health`

### Importante
- El tráfico real de producción hoy entra por Nginx hacia `127.0.0.1:3001` y `127.0.0.1:3010`.
- No documentar ni automatizar deploys de Martínez usando `docker-compose.martinez.yml` mientras la producción real siga operando con `docker-compose.yml`.
- Existe un stack paralelo `drizatx-martinez-*` que debe auditarse aparte.

---

## 2. Flujo correcto de deploy

### 2.1. Desarrollo
1. Crear una rama de trabajo desde `martinez/prod`.
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
3. Ejecuta:
   - `docker compose -f docker-compose.yml up -d --build`
4. Espera backend
5. Ejecuta healthcheck en:
   - `http://127.0.0.1:3001/api/health`
6. Si falla, muestra:
   - `docker compose ps`
   - logs del backend real
   - logs del frontend real

---

## 3. Validaciones post deploy

### 3.1. En VPS
```bash
cd /opt/drizatx_worktrees/martinez-prod
docker compose -f docker-compose.yml ps
curl -fsS http://127.0.0.1:3001/api/health
docker logs --tail 200 martinez-prod-backend-1
docker logs --tail 200 martinez-prod-frontend-1

3.2. Funcionales mínimas
La app carga en martinez.app.drizatx.com
La API responde correctamente en martinez.api.drizatx.com
Login funciona
Flujos críticos del negocio OK
Validar impresión si aplica
4. Rollback correcto
Principio

No tocar producción manualmente “a ojo”.
El rollback debe ser reproducible, auditable y basado en Git.

4.1. Rollback recomendado (git revert)
cd /opt/drizatx_worktrees/martinez-prod
git log --oneline -n 15
git checkout -b hotfix/martinez-rollback-YYYYMMDD-HHMM
git revert <commit_malo>
git push -u origin hotfix/martinez-rollback-YYYYMMDD-HHMM

Luego:
👉 merge a martinez/prod → deploy automático

4.2. Rollback operativo (emergencia)
cd /opt/drizatx_worktrees/martinez-prod
git log --oneline -n 15
git checkout martinez/prod
git reset --hard <commit_estable>
docker compose -f docker-compose.yml up -d --build

Validar:

curl -fsS http://127.0.0.1:3001/api/health
docker compose -f docker-compose.yml ps
docker logs --tail 200 martinez-prod-backend-1
docker logs --tail 200 martinez-prod-frontend-1
5. Qué NO hacer
No mergear main directo a martinez/prod
No usar push --force
No tocar docker-compose sin validar
No asumir que docker-compose.martinez.yml es producción
No ejecutar migraciones a ciegas
6. Checklist antes de deploy
 Rama correcta
 git status limpio
 PR revisado
 Compose validado
 Health endpoint OK
 Plan de rollback definido
7. Checklist de rollback
 Commit malo identificado
 Último commit estable identificado
 Opción elegida:
 revert (recomendado)
 rollback operativo (emergencia)
 Redeploy ejecutado correctamente
 Healthcheck OK (/api/health)
 Contenedores en estado Up (docker compose ps)
 Logs revisados
 Funcionalidad crítica validada
 Nginx OK
 Sistema estable

---

## 4. Guardar

En nano:


CTRL + O
ENTER
CTRL + X


---

## 5. Verificar

```bash
nl -ba docs/runbooks/martinez-deploy-and-rollback.md | sed -n '1,200p'
6. Estado git
git status --short
