# เว็บสวัสดิการ สตง. — แบบ Docker (ทางเลือก แทนการติดตั้ง Node.js บนเครื่องโดยตรง)
# build:  docker build --build-arg SITE_URL=https://welfare.example.go.th -t sao-welfare .
# run:    ดู docker-compose.yml   (ข้อมูลทั้งหมดอยู่ใน volume /app/data — ต้องสำรอง)
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG SITE_URL
ARG ALLOWED_HOSTS=""
ENV SITE_URL=$SITE_URL EMDASH_SITE_URL=$SITE_URL ALLOWED_HOSTS=$ALLOWED_HOSTS \
    DATABASE_PATH=/app/data/emdash.db UPLOADS_DIR=/app/data/uploads SESSIONS_DIR=/app/data/sessions
RUN node scripts/build-node.mjs && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 \
    DATABASE_PATH=/app/data/emdash.db UPLOADS_DIR=/app/data/uploads SESSIONS_DIR=/app/data/sessions BACKUP_DIR=/app/backups
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups
USER node
EXPOSE 4321
VOLUME ["/app/data", "/app/backups"]
CMD ["node", "./dist/server/entry.mjs"]
