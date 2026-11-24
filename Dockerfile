# เว็บสวัสดิการ สตง. — container image
# image สำเร็จรูป (ใช้ได้ทุกโดเมน ตั้ง SITE_URL ตอนรัน):
#   docker build -t sao-welfare .
# ถ้ารู้โดเมนแล้ว build เฉพาะโดเมนนั้นได้ (ปลอดภัยกว่าเล็กน้อย + ย่อรูปอัตโนมัติ):
#   docker build --build-arg SITE_URL=https://welfare.example.go.th --build-arg ALLOWED_HOSTS= -t sao-welfare .
# วิธีรัน: docs/self-hosting.md ข้อ 3B (ข้อมูลทั้งหมดอยู่ใน volume /app/data — ต้องสำรอง)
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG SITE_URL=""
ARG ALLOWED_HOSTS="*"
ENV SITE_URL=$SITE_URL EMDASH_SITE_URL=$SITE_URL ALLOWED_HOSTS=$ALLOWED_HOSTS \
    DATABASE_PATH=/app/data/emdash.db UPLOADS_DIR=/app/data/uploads SESSIONS_DIR=/app/data/sessions
RUN node scripts/build-node.mjs && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim
WORKDIR /app
LABEL org.opencontainers.image.title="sao-welfare" \
      org.opencontainers.image.description="เว็บไซต์สวัสดิการ สตง. + ระบบร้านค้าสวัสดิการ" \
      org.opencontainers.image.source="https://github.com/s4rawut/sao-sawatdikan-news-public"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 \
    DATABASE_PATH=/app/data/emdash.db UPLOADS_DIR=/app/data/uploads SESSIONS_DIR=/app/data/sessions BACKUP_DIR=/app/backups
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/seed ./seed
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups
USER node
EXPOSE 4321
VOLUME ["/app/data", "/app/backups"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "./dist/server/entry.mjs"]
