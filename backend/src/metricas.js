// Métricas en formato Prometheus con prom-client.
const client = require('prom-client');

const registro = new client.Registry();
registro.setDefaultLabels({ app: 'conectanet-backend' });

// CPU, memoria, event loop, GC... del proceso Node.js
client.collectDefaultMetrics({ register: registro });

// ---- Métricas HTTP (las cuatro señales doradas: tráfico, errores, latencia) ----
const peticionesHttp = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de peticiones HTTP atendidas',
  labelNames: ['metodo', 'ruta', 'estado'],
  registers: [registro],
});

const duracionHttp = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duración de las peticiones HTTP en segundos',
  labelNames: ['metodo', 'ruta', 'estado'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registro],
});

// ---- Métricas de negocio de ConectaNet ----
const registros = new client.Counter({
  name: 'conectanet_registros_total',
  help: 'Usuarios registrados',
  registers: [registro],
});

const logins = new client.Counter({
  name: 'conectanet_logins_total',
  help: 'Intentos de inicio de sesión por resultado',
  labelNames: ['resultado'], // exitoso | fallido
  registers: [registro],
});

const pagos = new client.Counter({
  name: 'conectanet_pagos_total',
  help: 'Pagos mensuales aprobados por método',
  labelNames: ['metodo'],
  registers: [registro],
});

const recaudo = new client.Counter({
  name: 'conectanet_recaudo_pesos_total',
  help: 'Dinero recaudado en pagos aprobados (COP)',
  registers: [registro],
});

// Un contador con etiquetas no aparece en /metrics hasta su primer incremento; se inicializan
// en 0 los valores conocidos para que Grafana muestre 0 y no "Sin datos".
for (const metodo of ['tarjeta', 'pse', 'efectivo']) pagos.inc({ metodo }, 0);
for (const resultado of ['exitoso', 'fallido']) logins.inc({ resultado }, 0);

/**
 * Middleware que mide cada petición. Se usa la ruta "plantilla" de Express
 * (/api/pagos/historial) y no la URL real, para no crear una serie por cada valor distinto.
 */
function medirPeticiones(req, res, next) {
  if (req.path === '/metrics') return next();
  const fin = duracionHttp.startTimer();
  res.on('finish', () => {
    // Si la respondió un middleware del router (p. ej. 401 de requiereAuth) no hay req.route,
    // pero sí req.baseUrl (/api/pagos). Sin ninguno de los dos, es una ruta inexistente.
    const ruta = req.route
      ? `${req.baseUrl}${req.route.path === '/' ? '' : req.route.path}`
      : req.baseUrl || 'no_encontrada';
    const etiquetas = { metodo: req.method, ruta, estado: String(res.statusCode) };
    peticionesHttp.inc(etiquetas);
    fin(etiquetas);
  });
  next();
}

async function endpointMetricas(req, res) {
  res.set('Content-Type', registro.contentType);
  res.end(await registro.metrics());
}

module.exports = {
  registro,
  medirPeticiones,
  endpointMetricas,
  negocio: { registros, logins, pagos, recaudo },
};
