const express = require('express');
const { Plan } = require('../models');

const router = express.Router();

// Consulta pública de los planes disponibles.
router.get('/', async (req, res, next) => {
  try {
    const planes = await Plan.findAll({
      where: { activo: true },
      order: [['precio', 'ASC']],
      attributes: ['id', 'nombre', 'tipo', 'velocidad', 'precio', 'descripcion'],
    });
    res.json(planes);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
