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
    url: process.env.DATABASE_URL,
    storage: process.env.DB_STORAGE || './conectanet.sqlite',
  },
  jwt: {
    // En desarrollo se usa un valor por defecto para no bloquear; en producción es obligatorio.
    secreto: process.env.JWT_SECRET || 'solo-para-desarrollo-no-usar-en-produccion',
    expiraEn: process.env.JWT_EXPIRES_IN || '2h',
  },
  corsOrigen: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
};
