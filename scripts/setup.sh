#!/bin/bash

# Script de configuración inicial
echo "⚙️  Configurando Sistema de Gestión de Colas DrizaTx"
echo "=================================================="

# Crear archivo .env.local para frontend si no existe
if [ ! -f "frontend/.env.local" ]; then
    echo "📝 Creando archivo de configuración del frontend..."
    cat > frontend/.env.local << EOL
# Configuración del Sistema de Gestión de Colas
NEXT_PUBLIC_API_MODE=false
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Servicios de notificación
NEXT_PUBLIC_SMS_ENABLED=true
NEXT_PUBLIC_PUSH_ENABLED=true
NEXT_PUBLIC_EMAIL_ENABLED=false

# Cambiar a true para usar backend real con MySQL
# NEXT_PUBLIC_API_MODE=true
EOL
    echo "✅ Archivo frontend/.env.local creado"
fi

# Crear archivo .env para backend si no existe
if [ ! -f "backend/.env" ]; then
    echo "📝 Creando configuración del backend..."
    cat > backend/.env << EOL
# Base de datos MySQL
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USERNAME=root
DATABASE_PASSWORD=
DATABASE_NAME=drizatx

# Configuración del servidor
NODE_ENV=development
PORT=3001

# CORS
FRONTEND_URL=http://localhost:3000
EOL
    echo "✅ Archivo backend/.env creado"
fi

# Instalar dependencias
echo "📦 Instalando dependencias..."
echo "   • Raíz del proyecto..."
npm install

echo "   • Frontend (carpeta frontend/)..."
cd frontend && npm install && cd ..

echo "   • Backend (carpeta backend/)..."
cd backend && npm install && cd ..

echo ""
echo "🎉 Configuración completada!"
echo ""
echo "Estructura del proyecto:"
echo "  • Frontend: Carpeta frontend/ (Next.js)"
echo "  • Backend: Carpeta backend/ (NestJS)"
echo ""
echo "Para iniciar el sistema:"
echo "  • Modo simulado: npm run dev"
echo "  • Con backend: npm run dev:full"
echo ""
echo "Para configurar MySQL:"
echo "  1. Instala MySQL 8.0+"
echo "  2. Ejecuta: npm run db:init"
echo "  3. Cambia NEXT_PUBLIC_API_MODE=true en frontend/.env.local"
echo ""