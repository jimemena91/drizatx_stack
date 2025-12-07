# Etapa 1: dependencias
FROM node:22-alpine AS deps
WORKDIR /app

# Copiamos package y lock
COPY package*.json ./
RUN npm install

# Etapa 2: build de Next.js
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules

# Copiamos el código del frontend
COPY . .

# Build de producción
RUN npm run build

# Etapa 3: runner (producción)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Usuario no root (buena práctica)
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# 👇 IMPORTANTE: traer node_modules a la imagen final
COPY --from=deps /app/node_modules ./node_modules

# Archivos de build y config
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package*.json ./
COPY next.config.* ./
COPY tailwind.config.* ./
COPY postcss.config.* ./
COPY tsconfig.* ./

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
