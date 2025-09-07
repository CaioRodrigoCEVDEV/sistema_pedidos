# ---------- Stage 1: deps ----------
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Instala dependências sem as devDependencies
RUN npm ci --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:18-alpine
ENV NODE_ENV=production
WORKDIR /app

# Cria usuário não-root
RUN addgroup -S nodejs && adduser -S node -G nodejs

# Copia dependências e código
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pasta de uploads + permissões
RUN mkdir -p /app/uploads && chown -R node:nodejs /app
USER node

# Porta do app (ajuste se não for 3000)
EXPOSE 3000

# Comando de start (ajuste se usar outro entrypoint)
CMD ["node", "src/index.js"]
