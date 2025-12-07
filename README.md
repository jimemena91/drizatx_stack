# Sistema Integral de Gestión de Colas - DrizaTx

Sistema completo de gestión de filas para entornos de atención masiva con tecnología moderna.  
Este repositorio actúa como **plantilla base (madre)** para desplegar DrizaTx en distintos clientes.

---

## 🚀 Inicio Rápido

### 🟣 Opción 1: Todo con Docker (recomendado)

```bash
# Desde la carpeta raíz del proyecto
npm install         # solo la primera vez
npm run docker:up   # levanta db + backend + frontend

Una vez levantado:

Frontend (panel y vistas):
http://localhost:3010

Backend API (NestJS):
http://localhost:3001

Swagger Docs:
http://localhost:3001/api/docs

Logs en vivo:

npm run docker:logs


Apagar todo:

npm run docker:down

🟢 Opción 2: Modo Simulado (solo frontend, sin backend real)
# Instalar dependencias frontend y backend (solo primera vez)
chmod +x scripts/setup.sh && ./scripts/setup.sh

# Iniciar en modo simulado (frontend con API mock)
npm run dev


Esto levanta el frontend (Next.js) en:

http://localhost:3000

🔵 Opción 3: Desarrollo local con Backend y MySQL (sin Docker)
# 1. Configuración inicial
chmod +x scripts/setup.sh && ./scripts/setup.sh

# 2. Instalar MySQL 8.0+
# Ubuntu/Debian: sudo apt install mysql-server
# macOS: brew install mysql
# Windows: Descargar desde mysql.com

# 3. Crear base de datos y tablas (estructura MySQL)
mysql -u root -p < scripts/001-create-tables.sql

# 4. Insertar datos iniciales (usuarios, servicios, permisos, etc.)
mysql --default-character-set=utf8mb4 -u root -p drizatx < scripts/002-seed-data.sql

# 5. Activar modo API real en frontend (frontend/.env.local)
# (ejemplo)
# NEXT_PUBLIC_API_MODE=true

# 6. Levantar backend (en carpeta backend/)
cd backend
npm run start:dev

# 7. Iniciar frontend en otra terminal (raíz del repo)
cd ..
npm run dev


Puertos por defecto en desarrollo local:

Frontend: http://localhost:3000

Backend: http://localhost:3001

Swagger: http://localhost:3001/api/docs

🐳 Desarrollo con Docker (Plantilla DrizaTx)

Este proyecto está preparado para correr con Docker usando 3 servicios:

db → MySQL 8

backend → API NestJS (puerto interno 3001)

frontend → Next.js (puerto interno 3000, expuesto como 3010)

Todo se orquesta desde el archivo docker-compose.yml en la carpeta raíz.

📦 Requisitos previos

Docker Desktop instalado y funcionando.

Node.js y npm (para manejar los scripts de la raíz).

🔧 Instalación inicial (solo primera vez)

En la carpeta raíz del proyecto:

npm install


Esto instala las dependencias de la raíz (incluye concurrently y los scripts de ayuda para Docker).
Las dependencias de frontend y backend se instalan dentro de los contenedores cuando se hace el build.

▶️ Levantar todo con Docker
npm run docker:up


Esto va a:

Levantar MySQL drizatx-mysql

Construir y levantar el backend NestJS drizatx-backend

Construir y levantar el frontend Next.js drizatx-frontend

Cuando termine:

Frontend (Next.js): http://localhost:3010

Backend (NestJS): http://localhost:3001

Documentación API (Swagger): http://localhost:3001/api/docs

🔐 Credenciales de Demo (entorno madre)

Usuario administrador por defecto (semilla de la base):

Usuario: superadmin

Email: superadmin@drizatx.com

Contraseña: Driza123!

Este usuario tiene todos los permisos en el sistema.

Si tus scripts de semillas agregan otros tipos de usuarios (supervisor, operador, etc.), podés documentarlos en una sección adicional específica por cliente.

🗄️ Datos de la base de datos (MySQL en Docker)

Para conectarte a la base desde tu PC (MySQL Workbench, DBeaver, etc.):

Host: 127.0.0.1

Puerto: 3307

Base de datos: drizatx

Usuario: driza

Contraseña: DrizaDB_2025

Dentro de Docker, el servicio se llama db y escucha en el puerto interno 3306.

🛠 Scripts Disponibles

Desde la raíz del repo:

# Frontend (modo simulado, sin backend real)
npm run dev

# Backend en modo desarrollo (NestJS con watch)
npm run dev:api

# Frontend + Backend en local (sin Docker)
npm run dev:full

# Construir frontend
npm run build

# Construir backend
npm run build:api

# Construir todo (frontend + backend)
npm run build:full

# Iniciar frontend en modo producción (fuera de Docker)
npm run start

# Iniciar backend en modo producción (fuera de Docker)
npm run start:api

# Iniciar frontend + backend en producción (fuera de Docker)
npm run start:full

# Base de datos local (scripts SQL)
npm run db:init

# Docker: levantar servicios
npm run docker:up

# Docker: apagar servicios
npm run docker:down

# Docker: ver logs en vivo
npm run docker:logs

# Docker: ver contenedores del proyecto
npm run docker:ps

# Docker: reconstruir imágenes y levantar
npm run docker:rebuild

# Docker: shell dentro del backend
npm run docker:backend-shell

# Docker: shell dentro de MySQL
npm run docker:db-shell

# Configuración inicial (dependencias frontend + backend, fuera de Docker)
npm run setup:full

🔧 Variables de Entorno
Frontend (frontend/.env.local)

Ejemplo típico en desarrollo local o Docker:

NEXT_PUBLIC_API_MODE=true                 # true para hablar con el backend real
NEXT_PUBLIC_API_URL=http://localhost:3001 # URL pública del backend (sin /api)
NEXT_PUBLIC_API_TIMEOUT_MS=15000          # Timeout de peticiones (ms)
NEXT_PUBLIC_API_HEALTHCHECK_PATH=/api/health
NEXT_PUBLIC_API_HEALTHCHECK_TIMEOUT_MS=5000
NEXT_PUBLIC_DEMO_MODE=0                   # 1 para usar datos locales (sin backend)


Notas:

Entorno local sin Docker: NEXT_PUBLIC_API_URL=http://localhost:3001

Entorno con Docker: sigue siendo http://localhost:3001 (porque mapeamos el puerto 3001 del contenedor al host).

Entorno remoto: usar dominio HTTPS real, por ejemplo https://drizatx-cliente.com.

Backend (backend/.env)

Ejemplo para desarrollo local sin Docker:

DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USERNAME=root
DATABASE_PASSWORD=tu_password
DATABASE_NAME=drizatx
PORT=3001
FRONTEND_URL=http://localhost:3000


Ejemplo típico dentro de Docker (ya viene del docker-compose.yml):

DATABASE_HOST=db
DATABASE_PORT=3306
DATABASE_USERNAME=driza
DATABASE_PASSWORD=DrizaDB_2025
DATABASE_NAME=drizatx
PORT=3001
FRONTEND_URLS=http://localhost:3010
JWT_SECRET=driza-super-secret-2025

☁️ Despliegue en Vercel

Vercel instala dependencias con npm install antes de compilar el frontend de Next.js. En entornos con conexiones
inestables hacia el registro de npm, ese paso puede fallar con errores ETIMEDOUT. Para mitigar esos fallos se añadió
un archivo .npmrc (en la raíz y en frontend/) que incrementa los fetch-retries y los timeouts de red, de modo que
Vercel vuelva a intentar la descarga de paquetes críticos antes de abortar el despliegue.

Si el problema persiste, verificar:

Node.js 18 o 20 en el proyecto de Vercel.

Región con salida a Internet sin restricciones hacia https://registry.npmjs.org/.

🖨️ Configuración de kioscos con impresión silenciosa

Las terminales de autoservicio pueden imprimir tickets sin mostrar el cuadro de diálogo del navegador si:

La opción "Impresión silenciosa en kiosco" está habilitada en el panel de administración (Ajustes → Terminales).

El navegador se inicia con el parámetro --kiosk-printing y la URL del kiosco incluye ?kioskPrinting=1 o ?kiosk=1.

Ejemplo de acceso directo en Windows:

"C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk "http://localhost:3010/terminal?kioskPrinting=1" ^
  --kiosk-printing --incognito --disable-infobars ^
  --noerrdialogs --disable-pinch --overscroll-history-navigation=0


Pasos recomendados:

Instalar drivers y dejar la impresora térmica como predeterminada.

Instalar Chrome/Chromium.

Crear acceso directo con los flags anteriores.

Configurar inicio automático del kiosco (carpeta Inicio de Windows).

Activar Impresión silenciosa en kiosco en DrizaTx.

Probar tomando un turno de prueba.

🏗 Arquitectura
drizatx-main/
├── frontend/              # Frontend Next.js
│   ├── app/               # Páginas Next.js
│   ├── components/        # Componentes React
│   ├── contexts/          # Context API (estado global)
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilidades y configuración
│   └── package.json       # Dependencias frontend
├── backend/               # Backend NestJS
│   ├── src/
│   │   ├── entities/      # Entidades TypeORM
│   │   ├── modules/       # Módulos NestJS
│   │   └── common/        # DTOs y utilidades
│   ├── scripts/           # Scripts SQL backend
│   └── package.json       # Dependencias backend
└── scripts/               # Scripts SQL y configuración global

🌐 Tecnologías

Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui, Recharts
Backend: NestJS, TypeORM, MySQL, Swagger, Class Validator
DevOps: Docker, Docker Compose, Scripts de automatización

📞 Soporte

Documentación: /docs en la aplicación (si se habilita)

Issues: GitHub Issues del proyecto

Email: soporte@drizatx.com

📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver LICENSE para más detalles.