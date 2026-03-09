# =========================
# 1) Dependencias
# =========================
FROM node:20-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm install

# =========================
# 2) Build
# =========================
FROM node:20-alpine AS builder
WORKDIR /app

# Variables de build (Next las incrusta en el bundle)
ARG BACKEND_URL
ARG NEXT_PUBLIC_API_MODE
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_PRINT_WEBHOOK_URL
ARG NEXT_PUBLIC_PRINT_WEBHOOK_TOKEN
ARG NEXT_PUBLIC_SMS_ENABLED
ARG NEXT_PUBLIC_PUSH_ENABLED

ENV BACKEND_URL=${BACKEND_URL}
ENV NEXT_PUBLIC_API_MODE=${NEXT_PUBLIC_API_MODE}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_PRINT_WEBHOOK_URL=${NEXT_PUBLIC_PRINT_WEBHOOK_URL}
ENV NEXT_PUBLIC_PRINT_WEBHOOK_TOKEN=${NEXT_PUBLIC_PRINT_WEBHOOK_TOKEN}
ENV NEXT_PUBLIC_SMS_ENABLED=${NEXT_PUBLIC_SMS_ENABLED}
ENV NEXT_PUBLIC_PUSH_ENABLED=${NEXT_PUBLIC_PUSH_ENABLED}

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# =========================
# 3) Runner
# =========================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Usuario no-root (opcional pero recomendado)
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copiamos lo necesario para ejecutar next start
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/tailwind.config.* ./
COPY --from=builder /app/postcss.config.* ./
COPY --from=builder /app/tsconfig.* ./

USER nextjs

EXPOSE 3000
CMD ["npm", "start"]
