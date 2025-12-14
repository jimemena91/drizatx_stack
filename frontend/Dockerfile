FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app

# ⬇️ Variables de build para Next (se incrustan en el bundle)
ARG BACKEND_URL
ARG NEXT_PUBLIC_API_MODE
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BASE_URL

ENV BACKEND_URL=${BACKEND_URL}
ENV NEXT_PUBLIC_API_MODE=${NEXT_PUBLIC_API_MODE}
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# usuario no root
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=deps /app/node_modules ./node_modules
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
