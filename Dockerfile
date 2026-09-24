# ---------- Frontend: compilação isolada em Node compatível com Vite ----------
FROM node:24-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
COPY public/css/theme.css /app/public/css/theme.css
RUN npm run build

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
COPY --from=frontend /app/frontend/dist ./frontend/dist

# Pasta de uploads + permissões
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "src/app.js"]
