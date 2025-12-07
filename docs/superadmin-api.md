# Guía Técnica para Superadministradores — API y Backend de DrizaTx

> **Confidencial:** este documento está restringido al superadministrador. No debe compartirse con operadores, supervisores ni con el público general.

## 1. Arquitectura general
- Frontend basado en Next.js (App Router) con estado global mediante Context API, persistencia en localStorage y componentes shadcn/ui. Las métricas se calculan en el cliente y se sincronizan con la API cuando está disponible.【F:frontend/app/(app)/docs/page.tsx†L31-L165】
- Backend opcional construido con NestJS, TypeORM y MySQL para persistencia real y publicación de endpoints REST protegidos por JWT y permisos granulares.【F:frontend/app/(app)/docs/page.tsx†L117-L127】【F:README.md†L162-L188】

## 2. Entornos y despliegue
- **Modo simulado:** ejecuta únicamente el frontend con datos mock (`npm run dev`).【F:README.md†L9-L16】
- **Modo desarrollo completo:** prepara dependencias, crea la base de datos, ejecuta migraciones SQL y levanta frontend + backend (`npm run dev:full`).【F:README.md†L18-L44】
- **Docker Compose:** expone Frontend en `:4200`, API NestJS en `:4100` y Swagger en `:3001/api` (`npm run docker:up`).【F:README.md†L46-L55】
- Producción recomendada: `npm run build:full` seguido de `npm run start:full` tras configurar variables de entorno y base de datos.【F:README.md†L127-L143】

## 3. Configuración de variables de entorno
### Frontend (`frontend/.env.local`)
Ajusta el modo de API, URLs y timeouts desde las variables públicas del cliente.【F:README.md†L98-L113】

### Backend (`backend/.env`)
Define host, puerto, credenciales y origen permitido para CORS del frontend.【F:README.md†L114-L123】

## 4. Base de datos y migraciones
- Motor recomendado: MySQL 8.0+. Ejecuta `scripts/001-create-tables.sql` para la estructura y `scripts/002-seed-data.sql` para datos base (roles, servicios, operadores demo).【F:README.md†L128-L135】
- Entidades principales expuestas por el backend: Service, Operator, Client, Ticket y SystemSetting, alineadas con el modelo de estado del frontend.【F:frontend/app/(app)/docs/page.tsx†L133-L165】

## 5. Endpoints principales
Los controladores NestJS siguen convenciones REST y están protegidos por `AuthGuard('jwt')` y `PermissionsGuard`.

| Recurso | Método | Ruta | Permisos requeridos | Descripción |
| --- | --- | --- | --- | --- |
| Servicios | GET | `/services` | `MANAGE_SERVICES` o `SERVE_TICKETS` | Listado completo de servicios activos y configurables.【F:backend/src/modules/services/services.controller.ts†L20-L43】
| Servicios | POST | `/services` | `MANAGE_SERVICES` | Alta de servicio con tiempos estimados y prefijos.【F:backend/src/modules/services/services.controller.ts†L44-L60】
| Cola | POST | `/queue/enqueue/:serviceId` | `SERVE_TICKETS` | Genera un ticket y lo asocia a un cliente opcional.【F:backend/src/modules/queue/queue.controller.ts†L22-L34】
| Cola | POST | `/queue/call/:ticketId/:operatorId` | `SERVE_TICKETS` | Marca un ticket como llamado por un operador determinado.【F:backend/src/modules/queue/queue.controller.ts†L35-L44】
| Cola | POST | `/queue/start/:ticketId` | `SERVE_TICKETS` | Inicia la atención y registra la marca temporal.【F:backend/src/modules/queue/queue.controller.ts†L45-L50】
| Cola | POST | `/queue/complete/:ticketId` | `SERVE_TICKETS` | Finaliza la atención y actualiza métricas.【F:backend/src/modules/queue/queue.controller.ts†L51-L56】
| Cola | GET | `/queue/dashboard` | `VIEW_DASHBOARD` o `SERVE_TICKETS` | Devuelve métricas agregadas para dashboards y cartelería.【F:backend/src/modules/queue/queue.controller.ts†L57-L62】

> Swagger se expone en `http://localhost:3001/api` cuando se ejecuta el backend en modo desarrollo o producción Docker.【F:README.md†L46-L55】

## 6. Seguridad y control de acceso
- El backend implementa guardas de permisos (`PermissionsGuard`) y un decorador `@Permissions` para validar acciones según el rol autenticado.【F:backend/src/modules/services/services.controller.ts†L12-L19】
- Los roles y permisos deben gestionarse desde el módulo de Administración dentro de la aplicación web; cualquier modificación directa en la base de datos debe registrarse en un acta de cambios.
- Regenera tokens JWT si cambias las claves o caducidades en la configuración de autenticación.

## 7. Procedimiento de respaldo
- El módulo de administración muestra el estado de los respaldos y permite forzar uno manual cuando la API está habilitada.【F:frontend/app/(app)/admin/page.tsx†L232-L2838】
- Complementa con copias externas programadas de la base MySQL mediante `mysqldump` u otra herramienta corporativa.
- Si el entorno no incluye `mysqldump` en el `PATH`, define la variable `BACKUP_MYSQLDUMP_PATH` (o `MYSQLDUMP_PATH`) con la ruta completa del ejecutable antes de habilitar los respaldos automáticos.【F:backend/src/modules/backups/backups.service.ts†L500-L579】

## 8. Escalamiento y soporte avanzado
- Problemas de despliegue en Vercel: verifica el archivo `.npmrc` y reintenta; hay valores extendidos de timeout para mitigar `ETIMEDOUT`.【F:README.md†L147-L158】
- Para monitoreo, habilita logs estructurados en NestJS (`backend/src/main.ts`) y conéctalos a la herramienta de observabilidad de tu organización.

---
Mantén este documento en un repositorio privado o bóveda de contraseñas accesible solo para superadministradores y equipo de infraestructura.
