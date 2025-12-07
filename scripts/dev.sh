#!/bin/bash

# Script para desarrollo local completo
echo "🚀 Iniciando Sistema de Gestión de Colas DrizaTx"
echo "================================================"

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Por favor instala Node.js 18+ primero."
    exit 1
fi

# Verificar si MySQL está instalado
if ! command -v mysql &> /dev/null; then
    echo "⚠️  MySQL no está instalado. Usando modo simulado."
    export NEXT_PUBLIC_API_MODE=false
else
    echo "✅ MySQL detectado. Configurando modo API."
    export NEXT_PUBLIC_API_MODE=true
fi

# Instalar dependencias si no existen
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Instalando dependencias del frontend..."
    cd frontend && npm install && cd ..
fi

if [ ! -d "backend/node_modules" ]; then
    echo "📦 Instalando dependencias del backend..."
    cd backend && npm install && cd ..
fi

# Mostrar estructura del proyecto
echo ""
echo "📁 Estructura del proyecto:"
echo "   • Frontend: ./frontend/ (Next.js)"
echo "   • Backend: ./backend/ (NestJS)"
echo ""

# Iniciar servicios
echo "🔄 Iniciando servicios..."

if [ "$NEXT_PUBLIC_API_MODE" = "true" ]; then
    echo "🗄️  Iniciando backend y frontend..."
    npm run dev:full
else
    echo "🎭 Iniciando solo frontend (modo simulado)..."
    npm run dev
fi
