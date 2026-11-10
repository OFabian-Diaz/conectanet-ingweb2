const { Sequelize, DataTypes } = require('sequelize');
const config = require('../config');

function crearConexion() {
  if (config.db.dialecto === 'sqlite') {
    return new Sequelize({
      dialect: 'sqlite',
      storage: config.db.storage, // ':memory:' en las pruebas
      logging: false,
    });
  }
  const opciones = {
    dialect: 'postgres',
    logging: false,
    dialectOptions: config.db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  };
  if (config.db.url) return new Sequelize(config.db.url, opciones);
  if (config.db.host) {
    return new Sequelize(config.db.nombre, config.db.usuario, config.db.contrasena, {
      ...opciones,
      host: config.db.host,
      port: config.db.puerto,
    });
  }
  throw new Error('Define DATABASE_URL o DB_HOST/DB_PASSWORD para PostgreSQL (o usa DB_DIALECT=sqlite)');
}

const sequelize = crearConexion();

// ---------- Usuario ----------
const Usuario = sequelize.define(
  'Usuario',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false },
    correo: { type: DataTypes.STRING(150), allowNull: false, unique: true, validate: { isEmail: true } },
    contrasena: { type: DataTypes.STRING(100), allowNull: false }, // hash bcrypt, nunca texto plano
    telefono: { type: DataTypes.STRING(20) },
    direccion: { type: DataTypes.STRING(200) },
  },
  {
    tableName: 'usuarios',
    underscored: true,
    defaultScope: { attributes: { exclude: ['contrasena'] } },
    scopes: { conContrasena: { attributes: { include: ['contrasena'] } } },
  }
);

// ---------- Plan ----------
const Plan = sequelize.define(
  'Plan',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false },
    tipo: { type: DataTypes.ENUM('internet', 'tv', 'combo'), allowNull: false, defaultValue: 'internet' },
    velocidad: { type: DataTypes.STRING(50) }, // p. ej. "300 Mbps"; null para planes solo TV
    precio: { type: DataTypes.DECIMAL(10, 2), allowNull: false, validate: { min: 0 } },
    descripcion: { type: DataTypes.TEXT },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { tableName: 'planes', underscored: true }
);

// ---------- Suscripción ----------
const Suscripcion = sequelize.define(
  'Suscripcion',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fechaInicio: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
    estado: {
      type: DataTypes.ENUM('pendiente', 'activa', 'cancelada'),
      allowNull: false,
      defaultValue: 'pendiente',
    },
  },
  { tableName: 'suscripciones', underscored: true }
);

// ---------- Pago ----------
const Pago = sequelize.define(
  'Pago',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    monto: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    periodo: { type: DataTypes.STRING(7), allowNull: false }, // "AAAA-MM": mes que se paga
    metodo: { type: DataTypes.ENUM('tarjeta', 'pse', 'efectivo'), allowNull: false },
    estado: {
      type: DataTypes.ENUM('aprobado', 'rechazado'),
      allowNull: false,
      defaultValue: 'aprobado',
    },
  },
  { tableName: 'pagos', underscored: true }
);

// ---------- Relaciones ----------
Usuario.hasMany(Suscripcion, { foreignKey: 'usuarioId', as: 'suscripciones' });
Suscripcion.belongsTo(Usuario, { foreignKey: 'usuarioId', as: 'usuario' });

Plan.hasMany(Suscripcion, { foreignKey: 'planId', as: 'suscripciones' });
Suscripcion.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });

Suscripcion.hasMany(Pago, { foreignKey: 'suscripcionId', as: 'pagos' });
Pago.belongsTo(Suscripcion, { foreignKey: 'suscripcionId', as: 'suscripcion' });

module.exports = { sequelize, Usuario, Plan, Suscripcion, Pago };
