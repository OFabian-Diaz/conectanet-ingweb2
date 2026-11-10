// Límite de peticiones (express-rate-limit) con almacenamiento compartido en Redis.
//
// Por qué Redis: con varias réplicas del backend (Kubernetes, Azure) cada una llevaría su
// propia cuenta en memoria y el límite real sería "límite × réplicas". Con Redis todas
// las réplicas consultan y actualizan el mismo contador.
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const config = require('./config');

let cliente = null;

function clienteRedis() {
  if (!config.redisUrl) return null;
  if (cliente) return cliente;

  const { createClient } = require('redis');
  cliente = createClient({
    url: config.redisUrl,
    // Si Redis no está disponible, los comandos fallan de inmediato en lugar de quedar en
    // cola: así una caída de Redis no deja colgado el login (ver passOnStoreError).
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: (intentos) => Math.min(intentos * 250, 5000), // reintenta para siempre
    },
  });

  let avisado = false;
  cliente.on('error', (err) => {
    if (!avisado) console.error(`Redis no disponible (${err.message}); el límite de intentos queda desactivado hasta que vuelva`);
    avisado = true;
  });
  cliente.on('ready', () => {
    if (avisado) console.log('Redis disponible de nuevo; límite de intentos compartido activo');
    avisado = false;
  });
  cliente.connect().catch(() => {}); // los fallos se reportan en 'error' y se reintenta solo

  return cliente;
}

/**
 * Envía un comando esperando como máximo `msMax` a que Redis esté listo. Evita un error
 * falso al arrancar (el limitador carga su script antes de que termine la conexión) y,
 * si Redis está caído, limita la espera del login a medio segundo.
 */
async function enviar(redis, args, msMax = 500) {
  if (!redis.isReady) {
    await new Promise((resolver) => {
      const t = setTimeout(listo, msMax);
      function listo() {
        clearTimeout(t);
        redis.off('ready', listo);
        resolver();
      }
      redis.once('ready', listo);
    });
  }
  return redis.sendCommand(args);
}

// Errores del almacenamiento: una línea, como máximo una vez por minuto (con Redis caído
// se producirían en cada login). Los avisos de configuración se muestran completos.
let ultimoAviso = 0;
const logger = {
  error(err, mensaje = '') {
    if (/store/i.test(mensaje)) {
      if (Date.now() - ultimoAviso > 60_000) {
        ultimoAviso = Date.now();
        console.error(`Límite de intentos sin Redis, se permite la petición: ${err && err.message}`);
      }
      return;
    }
    console.error(mensaje, err);
  },
  warn: (err, mensaje = '') => console.warn(mensaje, err),
};

/**
 * Crea un limitador. Con REDIS_URL usa Redis (compartido entre réplicas);
 * sin REDIS_URL, memoria local.
 */
function crearLimitador({ prefijo, ...opciones }) {
  const redis = clienteRedis();
  return rateLimit({
    ...opciones,
    // Si Redis falla se deja pasar la petición (fail-open): para un ISP es peor que un
    // cliente no pueda entrar a pagar que perder el límite unos minutos. Queda en los logs.
    passOnStoreError: true,
    logger,
    store: redis
      ? new RedisStore({
          prefix: `conectanet:limite:${prefijo}:`,
          sendCommand: (...args) => enviar(redis, args),
        })
      : undefined, // MemoryStore por defecto
  });
}

/** Estado para /api/salud: informativo, no afecta la readiness. */
function estadoLimitador() {
  if (!config.redisUrl) return 'memoria';
  return cliente && cliente.isReady ? 'redis' : 'redis-no-disponible';
}

async function cerrarRedis() {
  if (cliente && cliente.isOpen) await cliente.quit().catch(() => cliente.destroy());
}

module.exports = { crearLimitador, estadoLimitador, cerrarRedis };
