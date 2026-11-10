#!/usr/bin/env node
// Crea o completa el archivo .env de la raíz con secretos aleatorios.
// Nunca cambia un valor existente: solo agrega los que falten (p. ej. tras actualizar el proyecto).
// Uso: node scripts/generar-env.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const destino = path.join(__dirname, '..', '.env');
const aleatorio = (bytes) => crypto.randomBytes(bytes).toString('hex');

const requeridos = {
  POSTGRES_PASSWORD: () => aleatorio(24),
  JWT_SECRET: () => aleatorio(48),
  GRAFANA_ADMIN_PASSWORD: () => aleatorio(16),
  REDIS_PASSWORD: () => aleatorio(24),
};

const actual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : '';
const existentes = new Set(actual.split(/\r?\n/).map((l) => l.split('=')[0].trim()).filter(Boolean));
const faltantes = Object.keys(requeridos).filter((k) => !existentes.has(k));

if (!faltantes.length) {
  console.log('.env ya tiene todos los secretos; no se cambió nada.');
  process.exit(0);
}

const separador = actual && !actual.endsWith('\n') ? '\n' : '';
const nuevas = faltantes.map((k) => `${k}=${requeridos[k]()}`).join('\n') + '\n';
fs.writeFileSync(destino, actual + separador + nuevas, { mode: 0o600 });
console.log(`${actual ? '.env completado' : '.env creado'}; secretos agregados: ${faltantes.join(', ')}`);
