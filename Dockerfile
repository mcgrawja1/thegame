# ---------- Stage 1: build shared types, server and web client ----------
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first so this layer is cached between source changes.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci

COPY . .
RUN npm run build

# ---------- Stage 2: slim runtime image ----------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app

# Production dependencies only (workspace layout must match the build stage).
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev && npm cache clean --force

# Compiled output from the build stage.
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web/dist

# Run as the unprivileged "node" user that ships with the base image.
RUN chown -R node:node /app
USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "server/dist/server/src/index.js"]
