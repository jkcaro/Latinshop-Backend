const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ message: 'Token requerido' });

  const token = auth.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
