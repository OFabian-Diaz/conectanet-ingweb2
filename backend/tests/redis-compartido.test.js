// Dos instancias del backend (como dos réplicas en Kubernetes) comparten el límite de
// intentos a través de Redis. Requiere un Redis real: REDIS_URL_PRUEBAS=redis://localhost:6379
// (en el CI lo levanta un "service container"). Sin esa variable la prueba se omite.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawn } = require('child_process');

const REDIS_URL = process.env.REDIS_URL_PRUEBAS;
const PUERTOS = [4711, 4712];
const instancias = [];

function arrancar(puerto) {
  const codigo = `
    const app = require('./src/app');
    const { sequelize } = require('./src/models');
    sequelize.sync().then(() => app.listen(process.env.PORT, () => console.log('listo')));`;
  const hijo = spawn(process.execPath, ['-e', codigo], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'development', PORT: String(puerto), DB_DIALECT: 'sqlite', DB_STORAGE: ':memory:', REDIS_URL, TRUST_PROXY: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  instancias.push(hijo);
  return hijo;
}

async function esperarRedis(puerto) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await (await fetch(`http://127.0.0.1:${puerto}/api/salud`)).json();
      if (r.limiteIntentos === 'redis') return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`la instancia ${puerto} no se conectó a Redis`);
}

const login = (puerto) =>
  fetch(`http://127.0.0.1:${puerto}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'nadie@x.com', contrasena: 'Clave1234' }),
  }).then((r) => r.status);

before(async () => {
  if (!REDIS_URL) return;
  // Contadores limpios
  const { createClient } = require('redis');
  const c = createClient({ url: REDIS_URL });
  await c.connect();
  for await (const claves of c.scanIterator({ MATCH: 'conectanet:limite:*' })) {
    if (claves.length) await c.del(claves);
  }
  await c.quit();
  PUERTOS.forEach(arrancar);
  await Promise.all(PUERTOS.map(esperarRedis));
});

after(() => instancias.forEach((h) => h.kill()));

test('el límite de 20 intentos es compartido por dos réplicas', { skip: !REDIS_URL && 'define REDIS_URL_PRUEBAS' }, async () => {
  // 20 intentos repartidos: 10 en cada réplica. Con memoria local ninguna llegaría al límite.
  for (let i = 0; i < 20; i++) assert.equal(await login(PUERTOS[i % 2]), 401);
  assert.equal(await login(PUERTOS[0]), 429, 'réplica A bloquea el intento 21');
  assert.equal(await login(PUERTOS[1]), 429, 'réplica B también, porque comparte el contador');
});
