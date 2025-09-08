# ---------- Stage 1: deps ----------
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:18-alpine
ENV NODE_ENV=production
WORKDIR /app

# Copia dependências e código
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pasta de uploads + permissões
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "src/app.js"]
