# Backend NestJS - Sistema de Gestión de Colas

## Instalación y Configuración

### Requisitos
- Node.js 18+
- MySQL 8.0+
- npm o yarn

### Instalación Local

1. Instalar dependencias:
\`\`\`bash
npm install
\`\`\`

2. Configurar variables de entorno:
\`\`\`bash
cp .env.example .env
# Editar .env con tus configuraciones
\`\`\`

3. Crear base de datos:
\`\`\`bash
mysql -u root -p < scripts/001-create-database.sql
mysql -u root -p queue_management < scripts/002-seed-data.sql
\`\`\`

4. Iniciar en modo desarrollo:
\`\`\`bash
npm run start:dev
\`\`\`

### Instalación con Docker

1. Iniciar servicios:
\`\`\`bash
docker-compose up -d
\`\`\`

2. La base de datos se inicializará automáticamente con los scripts SQL.

## API Endpoints

### Servicios
- `GET /api/services` - Listar servicios
- `GET /api/services/active` - Servicios activos
- `POST /api/services` - Crear servicio
- `PATCH /api/services/:id` - Actualizar servicio
- `DELETE /api/services/:id` - Eliminar servicio

### Tickets
- `GET /api/tickets` - Listar tickets
- `GET /api/tickets/today` - Tickets de hoy
- `POST /api/tickets` - Crear ticket
- `POST /api/tickets/call-next?operatorId=1` - Llamar siguiente
- `PATCH /api/tickets/:id/status` - Actualizar estado

### Clientes
- `GET /api/clients` - Listar clientes
- `GET /api/clients/dni/:dni` - Buscar por DNI
- `GET /api/clients/search?q=query` - Buscar clientes
- `POST /api/clients` - Crear cliente
- `POST /api/clients/bulk` - Importación masiva

### Operadores
- `GET /api/operators` - Listar operadores
- `GET /api/operators/active` - Operadores activos
- `POST /api/operators` - Crear operador

### Estado de Colas
- `GET /api/queue/status` - Estado completo
- `GET /api/queue/operator/:id/stats` - Stats de operador
- `GET /api/queue/metrics/hourly` - Métricas por hora

### Configuraciones
- `GET /api/system-settings` - Listar configuraciones
- `GET /api/system-settings/key/:key` - Por clave
- `PATCH /api/system-settings/key/:key?value=nuevo` - Actualizar

## Documentación API

La documentación completa está disponible en:
http://localhost:4100/api/docs

## Estructura del Proyecto

\`\`\`
backend/
├── src/
│   ├── common/          # DTOs y utilidades compartidas
│   ├── config/          # Configuraciones (DB, etc.)
│   ├── entities/        # Entidades TypeORM
│   ├── modules/         # Módulos de funcionalidad
│   └── main.ts          # Punto de entrada
├── scripts/             # Scripts SQL de inicialización
└── docker-compose.yml   # Configuración Docker

--- a/README.md
+++ b/README.md
@@ -36,15 +36,33 @@
 
 ## Instalación Local
 
-1. Clonar el repositorio:
-```bash
-git clone https://github.com/tuusuario/queue-management-backend.git
-```
-
-2. Crear la base de datos en MySQL ejecutando los scripts en `scripts/001-init.sql` y `scripts/002-seed-data.sql`.
-
-3. Instalar dependencias:
-```bash
-npm install
-```
-
-4. Iniciar el servidor en modo desarrollo:
-```bash
-npm run start:dev
-```
+1. Clonar el repositorio:
+```bash
+git clone https://github.com/tuusuario/queue-management-backend.git
+cd queue-management-backend
+```
+
+2. Instalar dependencias:
+```bash
+npm install
+```
+
+3. Configurar variables de entorno:
+```bash
+cp .env.example .env
+# Editar .env con tus credenciales de MySQL o URL de Railway
+```
+
+4. Ejecutar migraciones (creación de tablas):
+```bash
+npm run migration:run
+```
+
+5. (Opcional) Cargar datos iniciales (servicios, operadores, etc.):
+```bash
+mysql -u root -p -h HOST -P PUERTO railway < scripts/002-seed-data.sql
+```
+
+6. Iniciar el servidor en modo desarrollo:
+```bash
+npm run start:dev
+```

