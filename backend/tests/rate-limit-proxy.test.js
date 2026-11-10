// Límite de intentos de login detrás de Nginx (TRUST_PROXY=1).
// Proceso propio: aquí el rate limiter SÍ está activo (NODE_ENV distinto de "test").
process.env.NODE_ENV = 'development';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.TRUST_PROXY = '1';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');

before(() => sequelize.sync({ force: true }));
after(() => sequelize.close());

// Nginx agrega la IP real del cliente al final de X-Forwarded-For
const loginDesde = (xff) =>
  request(app).post('/api/auth/login').set('X-Forwarded-For', xff).send({ correo: 'nadie@x.com', contrasena: 'Clave1234' });

test('cada cliente tiene su propio límite: bloquear a uno no bloquea a otro', async () => {
  for (let i = 0; i < 20; i++) assert.equal((await loginDesde('1.1.1.1')).status, 401);
  assert.equal((await loginDesde('1.1.1.1')).status, 429, 'el intento 21 del mismo cliente se bloquea');
  assert.equal((await loginDesde('2.2.2.2')).status, 401, 'otro cliente detrás del mismo Nginx no queda bloqueado');
});

test('falsificar X-Forwarded-For no permite saltarse el límite', async () => {
  // El atacante 1.1.1.1 envía "X-Forwarded-For: 9.9.9.9"; Nginx agrega su IP real al final.
  assert.equal((await loginDesde('9.9.9.9, 1.1.1.1')).status, 429);
});
