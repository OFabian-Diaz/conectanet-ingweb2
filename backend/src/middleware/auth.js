const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Verifica el JWT enviado en la cabecera "Authorization: Bearer <token>".
 * El token NO viaja en cookies, por eso el navegador no lo adjunta automáticamente
 * a peticiones de otros sitios: esto evita los ataques CSRF (OWASP A01).
 */
function requiereAuth(req, res, next) {
  const cabecera = req.get('Authorization') || '';
  const [esquema, token] = cabecera.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] });
    req.usuarioId = Number(payload.sub);
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function firmarToken(usuario) {
  return jwt.sign({ sub: String(usuario.id), nombre: usuario.nombre }, config.jwt.secreto, {
    algorithm: 'HS256',
    expiresIn: config.jwt.expiraEn,
  });
}

module.exports = { requiereAuth, firmarToken };
