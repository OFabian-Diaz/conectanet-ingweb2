// Pruebas de integración con el runner nativo de Node (node --test) y supertest.
// Usan SQLite en memoria para no depender de PostgreSQL.
process.env.NODE_ENV = 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';
process.env.JWT_SECRET = 'secreto-de-pruebas';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { sequelize } = require('../src/models');
const { sembrarPlanes } = require('../src/seed');

const ana = { nombre: 'Ana Pérez', correo: 'ana@correo.com', contrasena: 'Clave1234', telefono: '3001234567' };
let token;

before(async () => {
  await sequelize.sync({ force: true });
  await sembrarPlanes();
});
after(() => sequelize.close());

test('GET /api/planes es público y lista los planes por precio', async () => {
  const res = await request(app).get('/api/planes').expect(200);
  assert.ok(res.body.length >= 3);
  const precios = res.body.map((p) => Number(p.precio));
  assert.deepEqual(precios, [...precios].sort((a, b) => a - b));
});

test('POST /api/auth/registro crea el usuario con plan y devuelve un JWT', async () => {
  const res = await request(app).post('/api/auth/registro').send({ ...ana, planId: 2 }).expect(201);
  assert.ok(res.body.token);
  assert.equal(res.body.usuario.correo, ana.correo);
  assert.equal(res.body.usuario.contrasena, undefined);
});

test('registro rechaza correo duplicado (409)', async () => {
  await request(app).post('/api/auth/registro').send(ana).expect(409);
});

test('registro valida las entradas (400)', async () => {
  const res = await request(app)
    .post('/api/auth/registro')
    .send({ nombre: '<script>alert(1)</script>', correo: 'no-es-correo', contrasena: '123' })
    .expect(400);
  const campos = res.body.detalles.map((d) => d.campo);
  assert.ok(campos.includes('nombre'));
  assert.ok(campos.includes('correo'));
  assert.ok(campos.includes('contrasena'));
});

test('la contraseña se guarda cifrada con bcrypt', async () => {
  const { Usuario } = require('../src/models');
  const u = await Usuario.scope('conContrasena').findOne({ where: { correo: ana.correo } });
  assert.notEqual(u.contrasena, ana.contrasena);
  assert.match(u.contrasena, /^\$2[aby]\$12\$/);
});

test('POST /api/auth/login con clave incorrecta responde 401', async () => {
  await request(app).post('/api/auth/login').send({ correo: ana.correo, contrasena: 'Otra1234' }).expect(401);
});

test('intento de inyección SQL en el login no autentica', async () => {
  await request(app)
    .post('/api/auth/login')
    .send({ correo: "' OR 1=1 --@x.com", contrasena: "' OR '1'='1" })
    .expect((r) => assert.ok([400, 401].includes(r.status)));
});

test('POST /api/auth/login correcto devuelve token', async () => {
  const res = await request(app).post('/api/auth/login').send({ correo: ana.correo, contrasena: ana.contrasena }).expect(200);
  token = res.body.token;
  assert.ok(token);
});

test('rutas protegidas exigen token (401)', async () => {
  await request(app).get('/api/usuarios/mi-cuenta').expect(401);
  await request(app).post('/api/pagos').send({ metodo: 'pse' }).expect(401);
  await request(app).get('/api/pagos/historial').expect(401);
  await request(app).get('/api/usuarios/mi-cuenta').set('Authorization', 'Bearer token.falso.xx').expect(401);
});

test('token firmado con otro secreto es rechazado', async () => {
  const falso = jwt.sign({ sub: '1' }, 'otro-secreto');
  await request(app).get('/api/usuarios/mi-cuenta').set('Authorization', `Bearer ${falso}`).expect(401);
});

test('GET /api/usuarios/mi-cuenta muestra perfil y plan pendiente', async () => {
  const res = await request(app).get('/api/usuarios/mi-cuenta').set('Authorization', `Bearer ${token}`).expect(200);
  assert.equal(res.body.usuario.correo, ana.correo);
  assert.equal(res.body.usuario.contrasena, undefined);
  assert.equal(res.body.suscripcion.estado, 'pendiente');
  assert.equal(res.body.suscripcion.plan.id, 2);
});

test('POST /api/pagos valida el método', async () => {
  await request(app).post('/api/pagos').set('Authorization', `Bearer ${token}`).send({ metodo: 'bitcoin' }).expect(400);
});

test('POST /api/pagos cobra el precio del plan (ignora monto enviado) y activa la suscripción', async () => {
  const res = await request(app)
    .post('/api/pagos')
    .set('Authorization', `Bearer ${token}`)
    .send({ metodo: 'pse', monto: 1 })
    .expect(201);
  assert.equal(Number(res.body.monto), 75000);
  assert.equal(res.body.estado, 'aprobado');

  const cuenta = await request(app).get('/api/usuarios/mi-cuenta').set('Authorization', `Bearer ${token}`);
  assert.equal(cuenta.body.suscripcion.estado, 'activa');
});

test('no se puede pagar dos veces el mismo mes (409)', async () => {
  await request(app).post('/api/pagos').set('Authorization', `Bearer ${token}`).send({ metodo: 'tarjeta' }).expect(409);
});

test('GET /api/pagos/historial devuelve solo los pagos propios', async () => {
  const otro = await request(app)
    .post('/api/auth/registro')
    .send({ nombre: 'Luis', correo: 'luis@correo.com', contrasena: 'Clave5678', planId: 1 });
  await request(app).post('/api/pagos').set('Authorization', `Bearer ${otro.body.token}`).send({ metodo: 'efectivo' }).expect(201);

  const res = await request(app).get('/api/pagos/historial').set('Authorization', `Bearer ${token}`).expect(200);
  assert.equal(res.body.length, 1);
  assert.equal(res.body[0].plan, 'Internet Hogar');
});

test('PUT /api/usuarios/mi-cuenta/plan cambia de plan', async () => {
  const res = await request(app)
    .put('/api/usuarios/mi-cuenta/plan')
    .set('Authorization', `Bearer ${token}`)
    .send({ planId: 3 })
    .expect(201);
  assert.equal(res.body.estado, 'pendiente');
  await request(app).put('/api/usuarios/mi-cuenta/plan').set('Authorization', `Bearer ${token}`).send({ planId: 3 }).expect(409);
});

test('usuario sin plan no puede pagar (404)', async () => {
  const sinPlan = await request(app)
    .post('/api/auth/registro')
    .send({ nombre: 'Sara', correo: 'sara@correo.com', contrasena: 'Clave9999' });
  await request(app).post('/api/pagos').set('Authorization', `Bearer ${sinPlan.body.token}`).send({ metodo: 'pse' }).expect(404);
});

test('cabeceras de seguridad de helmet presentes y sin x-powered-by', async () => {
  const res = await request(app).get('/api/planes');
  assert.equal(res.headers['x-powered-by'], undefined);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(res.headers['content-security-policy']);
});

test('GET /metrics expone métricas Prometheus de Node, HTTP y negocio', async () => {
  const res = await request(app).get('/metrics').expect(200);
  assert.match(res.headers['content-type'], /text\/plain/);
  const m = res.text;
  assert.match(m, /process_cpu_user_seconds_total/); // métricas por defecto
  // Ruta plantilla, no la URL real; y 401 del middleware etiquetado con la ruta base
  assert.match(m, /http_requests_total\{[^}]*metodo="GET",ruta="\/api\/pagos\/historial",estado="200"/);
  assert.match(m, /http_requests_total\{[^}]*ruta="\/api\/pagos",estado="401"/);
  assert.match(m, /http_request_duration_seconds_bucket\{/);
  assert.match(m, /conectanet_registros_total\{[^}]*\} 3/); // Ana, Luis y Sara
  // 1 fallido: el intento de inyección SQL lo frena la validación (400) antes de autenticar
  assert.match(m, /conectanet_logins_total\{[^}]*resultado="fallido"[^}]*\} 1/);
  assert.match(m, /conectanet_logins_total\{[^}]*resultado="exitoso"[^}]*\} 1/);
  assert.match(m, /conectanet_pagos_total\{[^}]*metodo="pse"[^}]*\} 1/);
  assert.match(m, /conectanet_recaudo_pesos_total\{[^}]*\} 130000/); // 75000 + 55000
});

test('/metrics no queda expuesto bajo /api (Nginx solo publica /api)', async () => {
  await request(app).get('/api/metrics').expect(404);
});

test('Swagger expone la especificación OpenAPI 3.0', async () => {
  const res = await request(app).get('/api/docs.json').expect(200);
  assert.match(res.body.openapi, /^3\.0/);
  assert.ok(res.body.paths['/pagos/historial']);
  // El primer servidor es relativo: "Try it out" funciona detrás de Nginx sin exponer el puerto 4000
  assert.equal(res.body.servers[0].url, '/api');
});
