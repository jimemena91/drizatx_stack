# Sistema Integral de Gestión de Colas - DrizaTx
# Exportación completa del proyecto

## Estructura del proyecto:
\`\`\`
drizatx-queue-system/
├── frontend/ (Next.js)
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── contexts/
│   └── package.json
├── backend/ (NestJS + MySQL)
│   ├── src/
│   ├── scripts/
│   └── package.json
└── scripts/ (setup)
\`\`\`

## INSTRUCCIONES DE INSTALACIÓN:

### 1. Crear carpeta del proyecto:
\`\`\`bash
mkdir drizatx-queue-system
cd drizatx-queue-system
\`\`\`

### 2. Crear estructura de carpetas:
\`\`\`bash
mkdir frontend backend scripts
\`\`\`

### 3. Frontend (Next.js):
\`\`\`bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
\`\`\`

### 4. Instalar dependencias del frontend:
\`\`\`bash
npm install @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-avatar @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-sidebar @radix-ui/react-slot @radix-ui/react-toast lucide-react recharts class-variance-authority clsx tailwind-merge
\`\`\`

### 5. Backend (NestJS):
\`\`\`bash
cd ../backend
npm init -y
npm install @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/typeorm @nestjs/swagger @nestjs/config typeorm mysql2 class-validator class-transformer swagger-ui-express reflect-metadata rxjs
npm install -D @nestjs/cli @types/node typescript ts-node nodemon
\`\`\`

### 6. Variables de entorno:
Crear `frontend/.env.local`:
\`\`\`
NEXT_PUBLIC_API_MODE=false
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SMS_ENABLED=true
NEXT_PUBLIC_PUSH_ENABLED=true
\`\`\`

Crear `backend/.env`:
\`\`\`
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USERNAME=root
DATABASE_PASSWORD=password
DATABASE_NAME=drizatx
FRONTEND_URL=http://localhost:3000
PORT=3001
\`\`\`

## SCRIPTS DE CONFIGURACIÓN:

### Raíz - package.json:
\`\`\`json
{
  "name": "drizatx-queue-system",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["frontend", "backend"],
  "scripts": {
    "dev": "cd frontend && npm run dev",
    "dev:api": "cd backend && npm run start:dev",
    "dev:full": "concurrently \"npm run dev:api\" \"npm run dev\"",
    "build": "cd frontend && npm run build",
    "build:api": "cd backend && npm run build",
    "build:full": "npm run build:api && npm run build",
    "start": "cd frontend && npm run start",
    "start:api": "cd backend && npm run start:prod",
    "start:full": "concurrently \"npm run start:api\" \"npm run start\"",
    "setup:full": "npm install && cd frontend && npm install && cd ../backend && npm install",
    "db:init": "cd backend && mysql -u root -p < scripts/001-create-database.sql && mysql -u root -p drizatx < scripts/002-seed-data.sql"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
\`\`\`

## CREDENCIALES DE DEMO:
- **Admin:** `admin` / `admin123`
- **Supervisor:** `supervisor` / `super123`
- **Operador:** `operator` / `oper123`

## FUNCIONALIDADES PRINCIPALES:
- ✅ Sistema de autenticación con roles
- ✅ Gestión de colas en tiempo real
- ✅ Terminal de autoservicio con QR
- ✅ Cartelería digital con audio
- ✅ App móvil para seguimiento
- ✅ Reportes y analytics
- ✅ Notificaciones SMS/Push
- ✅ Navegación por teclado
- ✅ Mensajes personalizados
- ✅ Estimación dinámica de tiempos
- ✅ Gestión de clientes con DNI

## NOTA IMPORTANTE:
Este archivo contiene la estructura básica. Para obtener todos los archivos de código, usa el botón "Download Code" en la interfaz de v0 o copia manualmente cada archivo mostrado en los bloques de código de la conversación.

La base de datos se llama **drizatx** y el sistema funciona tanto en modo simulado (sin BD) como con backend real MySQL.
