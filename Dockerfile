# ---- Stage 1: build the frontend ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: production runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install ONLY production deps (better-sqlite3 needs build toolchain to compile).
COPY package*.json ./
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && npm ci --omit=dev \
  && apt-get purge -y python3 make g++ && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

# App source + built frontend
COPY server ./server
COPY --from=build /app/dist ./dist

# Writable runtime dirs (data + uploads) owned by the non-root node user
RUN mkdir -p /app/uploads /app/data && chown -R node:node /app/uploads /app/data
ENV UPLOAD_DIR=/app/uploads \
    DB_FILE=/app/data/anon.db \
    PORT=5000

USER node
EXPOSE 5000

# Container healthcheck hits the API health route
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server/server.js"]
