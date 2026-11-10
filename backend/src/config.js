require('dotenv').config();

const entorno = process.env.NODE_ENV || 'development';

if (!process.env.JWT_SECRET && entorno === 'production') {
  throw new Error('JWT_SECRET es obligatorio en producción');
}

module.exports = {
  entorno,
  puerto: Number(process.env.PORT) || 4000,
  db: {
    dialecto: process.env.DB_DIALECT || 'postgres',
    // Opción 1: una URL completa. Opción 2 (Docker/Kubernetes): variables sueltas,
    // así la contraseña puede venir de un Secret sin armar URLs a mano.
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    puerto: Number(process.env.DB_PORT) || 5432,
    nombre: process.env.DB_NAME || 'conectanet',
    usuario: process.env.DB_USER || 'conectanet',
    contrasena: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true', // necesario en bases gestionadas en la nube
    // Con varias réplicas (Kubernetes) las tablas las crea un Job una sola vez: DB_SYNC=false.
    sync: process.env.DB_SYNC !== 'false',
    storage: process.env.DB_STORAGE || './conectanet.sqlite',
  },
  jwt: {
    // En desarrollo se usa un valor por defecto para no bloquear; en producción es obligatorio.
    secreto: process.env.JWT_SECRET || 'solo-para-desarrollo-no-usar-en-produccion',
    expiraEn: process.env.JWT_EXPIRES_IN || '2h',
  },
  corsOrigen: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  // Cantidad de proxies de confianza delante de la API (Nginx = 1). Sin esto, detrás de
  // Nginx todos los usuarios comparten la IP del proxy y el límite de intentos de login
  // sería común para todos. Con 0 (por defecto, sin proxy) se ignora X-Forwarded-For,
  // porque un cliente podría falsificarlo para saltarse el límite.
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
};
