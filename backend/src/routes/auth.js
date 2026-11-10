const express = require('express');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { sequelize, Usuario, Plan, Suscripcion } = require('../models');
const { validar, SIN_HTML } = require('../middleware/validar');
const { firmarToken } = require('../middleware/auth');
const { negocio } = require('../metricas');

const router = express.Router();
const RONDAS_BCRYPT = 12;

// Limita intentos para frenar fuerza bruta (OWASP A07: fallas de autenticación).
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Demasiados intentos, intenta de nuevo en 15 minutos' },
});

router.post(
  '/registro',
  limiteAuth,
  [
    body('nombre').trim().isLength({ min: 2, max: 100 }).withMessage('El nombre debe tener entre 2 y 100 caracteres')
      .matches(SIN_HTML).withMessage('El nombre contiene caracteres no permitidos'),
    body('correo').trim().isEmail().withMessage('Correo inválido').normalizeEmail(),
    body('contrasena')
      .isLength({ min: 8, max: 72 }).withMessage('La contraseña debe tener entre 8 y 72 caracteres')
      .matches(/[A-Za-z]/).withMessage('La contraseña debe incluir letras')
      .matches(/\d/).withMessage('La contraseña debe incluir números'),
    body('telefono').optional({ values: 'falsy' }).trim().matches(/^[0-9+\-\s]{7,20}$/).withMessage('Teléfono inválido'),
    body('direccion').optional({ values: 'falsy' }).trim().isLength({ max: 200 })
      .matches(SIN_HTML).withMessage('La dirección contiene caracteres no permitidos'),
    body('planId').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('planId debe ser un entero').toInt(),
  ],
  validar,
  async (req, res, next) => {
    try {
      const { nombre, correo, contrasena, telefono, direccion, planId } = req.body;

      if (await Usuario.findOne({ where: { correo } })) {
        return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
      }

      if (planId) {
        const plan = await Plan.findOne({ where: { id: planId, activo: true } });
        if (!plan) return res.status(404).json({ error: 'El plan seleccionado no existe' });
      }

      const hash = await bcrypt.hash(contrasena, RONDAS_BCRYPT);

      const usuario = await sequelize.transaction(async (t) => {
        const nuevo = await Usuario.create(
          { nombre, correo, contrasena: hash, telefono, direccion },
          { transaction: t }
        );
        if (planId) {
          await Suscripcion.create({ usuarioId: nuevo.id, planId }, { transaction: t });
        }
        return nuevo;
      });

      negocio.registros.inc();
      return res.status(201).json({
        token: firmarToken(usuario),
        usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
      });
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/login',
  limiteAuth,
  [
    body('correo').trim().isEmail().withMessage('Correo inválido').normalizeEmail(),
    body('contrasena').isString().notEmpty().withMessage('La contraseña es obligatoria'),
  ],
  validar,
  async (req, res, next) => {
    try {
      const { correo, contrasena } = req.body;
      const usuario = await Usuario.scope('conContrasena').findOne({ where: { correo } });

      // Mismo mensaje si el correo no existe o la clave es incorrecta: no revela qué cuentas existen.
      const valido = usuario && (await bcrypt.compare(contrasena, usuario.contrasena));
      negocio.logins.inc({ resultado: valido ? 'exitoso' : 'fallido' });
      if (!valido) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

      return res.json({
        token: firmarToken(usuario),
        usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo },
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = router;
