const express = require('express');
const { body } = require('express-validator');
const { sequelize, Pago, Suscripcion } = require('../models');
const { requiereAuth } = require('../middleware/auth');
const { validar } = require('../middleware/validar');
const { suscripcionVigente } = require('./usuarios');
const { negocio } = require('../metricas');

const router = express.Router();
router.use(requiereAuth); // todas las rutas de pagos son protegidas

function periodoActual() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Pago mensual simulado. El monto lo calcula el servidor a partir del precio del plan:
 * el cliente no puede enviar ni alterar el valor a pagar.
 */
router.post(
  '/',
  [body('metodo').isIn(['tarjeta', 'pse', 'efectivo']).withMessage('Método debe ser tarjeta, pse o efectivo')],
  validar,
  async (req, res, next) => {
    try {
      const suscripcion = await suscripcionVigente(req.usuarioId);
      if (!suscripcion) {
        return res.status(404).json({ error: 'No tienes un plan contratado' });
      }

      const periodo = periodoActual();
      const yaPagado = await Pago.findOne({
        where: { suscripcionId: suscripcion.id, periodo, estado: 'aprobado' },
      });
      if (yaPagado) {
        return res.status(409).json({ error: `El periodo ${periodo} ya está pagado` });
      }

      const pago = await sequelize.transaction(async (t) => {
        const nuevo = await Pago.create(
          {
            suscripcionId: suscripcion.id,
            monto: suscripcion.plan.precio,
            periodo,
            metodo: req.body.metodo,
            estado: 'aprobado',
          },
          { transaction: t }
        );
        if (suscripcion.estado !== 'activa') {
          await Suscripcion.update({ estado: 'activa' }, { where: { id: suscripcion.id }, transaction: t });
        }
        return nuevo;
      });

      negocio.pagos.inc({ metodo: pago.metodo });
      negocio.recaudo.inc(Number(pago.monto));
      return res.status(201).json({
        id: pago.id,
        monto: pago.monto,
        fecha: pago.fecha,
        periodo: pago.periodo,
        metodo: pago.metodo,
        estado: pago.estado,
        plan: suscripcion.plan.nombre,
        suscripcionEstado: 'activa',
      });
    } catch (err) {
      return next(err);
    }
  }
);

// Historial de pagos de todas las suscripciones del usuario autenticado.
router.get('/historial', async (req, res, next) => {
  try {
    const pagos = await Pago.findAll({
      attributes: ['id', 'monto', 'fecha', 'periodo', 'metodo', 'estado'],
      include: [
        {
          model: Suscripcion,
          as: 'suscripcion',
          attributes: ['id'],
          where: { usuarioId: req.usuarioId },
          include: ['plan'],
        },
      ],
      order: [['fecha', 'DESC']],
    });

    res.json(
      pagos.map((p) => ({
        id: p.id,
        monto: p.monto,
        fecha: p.fecha,
        periodo: p.periodo,
        metodo: p.metodo,
        estado: p.estado,
        plan: p.suscripcion.plan ? p.suscripcion.plan.nombre : null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
