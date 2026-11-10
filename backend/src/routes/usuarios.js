const express = require('express');
const { body } = require('express-validator');
const { Usuario, Plan, Suscripcion } = require('../models');
const { requiereAuth } = require('../middleware/auth');
const { validar } = require('../middleware/validar');

const router = express.Router();

/** Suscripción vigente (no cancelada) más reciente del usuario. */
function suscripcionVigente(usuarioId) {
  return Suscripcion.findOne({
    where: { usuarioId, estado: ['pendiente', 'activa'] },
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'nombre', 'tipo', 'velocidad', 'precio', 'descripcion'] }],
    order: [['createdAt', 'DESC']],
  });
}

// Perfil y plan del usuario autenticado. Siempre se usa el id del token,
// nunca uno enviado por el cliente (evita IDOR, OWASP A01).
router.get('/mi-cuenta', requiereAuth, async (req, res, next) => {
  try {
    const usuario = await Usuario.findByPk(req.usuarioId, {
      attributes: ['id', 'nombre', 'correo', 'telefono', 'direccion', 'createdAt'],
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const suscripcion = await suscripcionVigente(req.usuarioId);
    return res.json({
      usuario,
      suscripcion: suscripcion
        ? { id: suscripcion.id, estado: suscripcion.estado, fechaInicio: suscripcion.fechaInicio, plan: suscripcion.plan }
        : null,
    });
  } catch (err) {
    return next(err);
  }
});

// Contratar o cambiar de plan. La suscripción anterior se cancela y la nueva queda
// "pendiente" hasta el primer pago.
router.put(
  '/mi-cuenta/plan',
  requiereAuth,
  [body('planId').isInt({ min: 1 }).withMessage('planId debe ser un entero').toInt()],
  validar,
  async (req, res, next) => {
    try {
      const plan = await Plan.findOne({ where: { id: req.body.planId, activo: true } });
      if (!plan) return res.status(404).json({ error: 'El plan seleccionado no existe' });

      const actual = await suscripcionVigente(req.usuarioId);
      if (actual && actual.planId === plan.id) {
        return res.status(409).json({ error: 'Ya tienes contratado ese plan' });
      }
      if (actual) await actual.update({ estado: 'cancelada' });

      const nueva = await Suscripcion.create({ usuarioId: req.usuarioId, planId: plan.id });
      return res.status(201).json({
        id: nueva.id,
        estado: nueva.estado,
        fechaInicio: nueva.fechaInicio,
        plan: { id: plan.id, nombre: plan.nombre, precio: plan.precio },
      });
    } catch (err) {
      return next(err);
    }
  }
);

module.exports = { router, suscripcionVigente };
