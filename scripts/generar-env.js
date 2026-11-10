#!/usr/bin/env node
// Crea el archivo .env de la raíz con secretos aleatorios (si no existe).
// Uso: node scripts/generar-env.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const destino = path.join(__dirname, '..', '.env');
if (fs.existsSync(destino)) {
  console.log('.env ya existe; no se sobrescribe.');
  process.exit(0);
}

const aleatorio = (bytes) => crypto.randomBytes(bytes).toString('hex');
const contenido = [
  `POSTGRES_PASSWORD=${aleatorio(24)}`,
  `JWT_SECRET=${aleatorio(48)}`,
  `GRAFANA_ADMIN_PASSWORD=${aleatorio(16)}`,
  '',
].join('\n');

fs.writeFileSync(destino, contenido, { mode: 0o600 });
console.log('.env creado con secretos aleatorios.');
