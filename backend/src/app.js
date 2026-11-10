const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');

const app = express();

// --- Seguridad (OWASP Top 10) ---
app.disable('x-powered-by'); // no revelar la tecnología del servidor
app.use(helmet()); // cabeceras: CSP, X-Content-Type-Options, frameguard, HSTS...
app.use(cors({ origin: config.corsOrigen, methods: ['GET', 'POST', 'PUT'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '10kb' })); // limita el tamaño del cuerpo

// --- Documentación Swagger (OpenAPI 3.0) ---
const especificacion = YAML.parse(fs.readFileSync(path.join(__dirname, 'docs', 'openapi.yaml'), 'utf8'));
app.get('/api/docs.json', (req, res) => res.json(especificacion));
// Swagger UI usa scripts en línea: se relaja la CSP solo para esa ruta.
app.use(
  '/api/docs',
  helmet.contentSecurityPolicy({
    directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'] },
  }),
  swaggerUi.serve,
  swaggerUi.setup(especificacion, { customSiteTitle: 'ConectaNet API' })
);

// --- Rutas ---
app.get('/api/salud', (req, res) => res.json({ estado: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/planes', require('./routes/planes'));
app.use('/api/usuarios', require('./routes/usuarios').router);
app.use('/api/pagos', require('./routes/pagos'));

app.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));

// Manejador de errores: no expone trazas internas al cliente.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON mal formado' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Cuerpo de la petición demasiado grande' });
  if (config.entorno !== 'test') console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

module.exports = app;
