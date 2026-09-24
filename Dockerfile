# ==========================================
# Stage 1: Build Frontend (Vite + React)
# ==========================================
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# ==========================================
# Stage 2: Production Server Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
ENV CLIENT_DIST_PATH=/app/client/dist

WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev

COPY server/src ./src

# Copy built frontend from Stage 1
COPY --from=client-builder /app/client/dist /app/client/dist

WORKDIR /app
EXPOSE 5000

CMD ["node", "server/src/server.js"]
