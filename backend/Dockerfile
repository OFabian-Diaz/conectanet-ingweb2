# API de ConectaNet (Node.js + Express)
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# 1) Solo los manifiestos: esta capa se reutiliza mientras no cambien las dependencias.
#    --omit=dev excluye supertest y sqlite3 (en el contenedor se usa PostgreSQL).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 2) Código de la aplicación
COPY src ./src

# Se ejecuta con el usuario sin privilegios que trae la imagen oficial
USER node

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
