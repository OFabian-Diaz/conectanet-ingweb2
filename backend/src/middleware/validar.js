const { validationResult } = require('express-validator');

/** Corta la petición con 400 si alguna regla de express-validator falló. */
function validar(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({
      error: 'Datos de entrada inválidos',
      detalles: errores.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
    });
  }
  return next();
}

// Rechaza caracteres usados en inyección de HTML/JS (XSS almacenado).
const SIN_HTML = /^[^<>"'`]*$/;

module.exports = { validar, SIN_HTML };
