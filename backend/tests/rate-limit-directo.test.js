// Sin proxy delante (TRUST_PROXY=0, valor por defecto): X-Forwarded-For se ignora.
process.env.NODE_ENV = 'development';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.TRUST_PROXY = '0';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');

before(() => sequelize.sync({ force: true }));
after(() => sequelize.close());

test('sin proxy, cambiar X-Forwarded-For en cada intento no evita el bloqueo', async () => {
  for (let i = 0; i < 20; i++) {
    const r = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', `10.0.0.${i}`) // el atacante inventa una IP distinta cada vez
      .send({ correo: 'nadie@x.com', contrasena: 'Clave1234' });
    assert.equal(r.status, 401);
  }
  const r = await request(app).post('/api/auth/login').set('X-Forwarded-For', '10.0.0.99').send({ correo: 'nadie@x.com', contrasena: 'Clave1234' });
  assert.equal(r.status, 429);
});
