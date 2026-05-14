const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const { enviarEmail, htmlResetPassword } = require('../utils/email');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña requeridos' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT u.*, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.email = ? AND u.activo = 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    const user = rows[0];

    // Soporta hashes bcrypt y contraseñas demo en texto plano para datos iniciales
    let valid = false;
    const isBcrypt = user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2a$');
    if (isBcrypt) {
      valid = await bcrypt.compare(password, user.password_hash);
    } else {
      valid = user.password_hash === password;
    }

    if (!valid) {
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }

    // Obtener tienda_id si el usuario es TIENDA
    let tiendaId = null;
    if (user.rol === 'TIENDA') {
      const [tienda] = await pool.query('SELECT id FROM tiendas WHERE usuario_id = ?', [user.id]);
      tiendaId = tienda.length ? tienda[0].id : null;
    }

    // Obtener cliente_id y ciudad_id si el usuario es CLIENTE
    let clienteId = null;
    let ciudadId = null;
    if (user.rol === 'CLIENTE') {
      const [cliente] = await pool.query('SELECT id, ciudad_id, direccion FROM clientes WHERE usuario_id = ?', [user.id]);
      clienteId = cliente.length ? cliente[0].id : null;
      ciudadId = cliente.length ? (cliente[0].ciudad_id ?? null) : null;
      var direccionCliente = cliente.length ? (cliente[0].direccion ?? '') : '';
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, tiendaId, clienteId, ciudadId },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellidos: user.apellidos,
        email: user.email,
        rol: user.rol,
        telefono: user.telefono,
        fotoPerfil: user.foto_perfil ?? '',
        tiendaId,
        clienteId,
        ciudadId,
        direccion: direccionCliente ?? ''
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// POST /api/auth/registro-cliente
router.post('/registro', async (req, res) => {
  const { nombre, apellidos, email, password, telefono, ciudad_id, direccion, acepta_privacidad } = req.body;
  if (!nombre || !email || !password) {
    return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios' });
  }

  if (!acepta_privacidad) {
    return res.status(400).json({ message: 'Debes aceptar la política de privacidad para registrarte' });
  }

  try {
    const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existe.length) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    const hash = await bcrypt.hash(password, 10);

    const [userResult] = await pool.query(
      `INSERT INTO usuarios (rol_id, nombre, apellidos, email, password_hash, telefono, activo, email_verificado)
       VALUES (2, ?, ?, ?, ?, ?, 1, 0)`,
      [nombre, apellidos ?? '', email, hash, telefono ?? '']
    );

    await pool.query(
      `INSERT INTO clientes (usuario_id, direccion, ciudad_id, codigo_postal, acepta_privacidad, fecha_acepta_privacidad)
       VALUES (?, ?, ?, '', 1, NOW())`,
      [userResult.insertId, direccion ?? '', ciudad_id ?? null]
    );

    res.status(201).json({ message: 'Registro exitoso. Ya puedes iniciar sesión.' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/auth/perfil - perfil del usuario autenticado
router.get('/perfil', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.nombre, u.apellidos, u.email, u.telefono, r.nombre AS rol
       FROM usuarios u JOIN roles r ON u.rol_id = r.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/auth/perfil - actualizar perfil
router.put('/perfil', verifyToken, async (req, res) => {
  const { nombre, apellidos, email, telefono, fotoPerfil, ciudadId, direccion } = req.body;
  try {
    await pool.query(
      'UPDATE usuarios SET nombre=?, apellidos=?, email=?, telefono=?, foto_perfil=?, fecha_actualizacion=NOW() WHERE id=?',
      [nombre, apellidos, email, telefono, fotoPerfil ?? null, req.user.id]
    );
    if (req.user.rol === 'CLIENTE') {
      const updates = [];
      const params = [];
      if (ciudadId != null) { updates.push('ciudad_id=?'); params.push(ciudadId); }
      if (direccion != null) { updates.push('direccion=?'); params.push(direccion); }
      if (updates.length) {
        params.push(req.user.id);
        await pool.query(`UPDATE clientes SET ${updates.join(', ')} WHERE usuario_id=?`, params);
      }
    }
    res.json({ message: 'Perfil actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/auth/password - cambiar contraseña
router.put('/password', verifyToken, async (req, res) => {
  const { passwordActual, passwordNueva } = req.body;
  if (!passwordActual || !passwordNueva) {
    return res.status(400).json({ message: 'Se requiere contraseña actual y nueva' });
  }

  try {
    const [rows] = await pool.query('SELECT password_hash FROM usuarios WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ message: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(passwordActual, rows[0].password_hash);
    if (!valid) return res.status(401).json({ message: 'Contraseña actual incorrecta' });

    const hash = await bcrypt.hash(passwordNueva, 10);
    await pool.query('UPDATE usuarios SET password_hash=? WHERE id=?', [hash, req.user.id]);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// POST /api/auth/solicitar-reset — envía email con enlace de recuperación
router.post('/solicitar-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'El email es obligatorio' });

  try {
    const [rows] = await pool.query(
      'SELECT id, nombre FROM usuarios WHERE email = ? AND activo = 1',
      [email]
    );

    // Respuesta genérica para no revelar si el email existe
    if (!rows.length) {
      return res.json({ message: 'Si el correo está registrado recibirás el enlace en breve.' });
    }

    const user = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Invalida tokens anteriores del mismo usuario
    await pool.query(
      'UPDATE password_reset_tokens SET usado = 1 WHERE usuario_id = ? AND usado = 0',
      [user.id]
    );

    await pool.query(
      'INSERT INTO password_reset_tokens (usuario_id, token, expira_en) VALUES (?, ?, ?)',
      [user.id, token, expira]
    );

    const enlace = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    await enviarEmail({
      to: email,
      subject: 'Recuperar contraseña — LatinShop España',
      html: htmlResetPassword(user.nombre, enlace)
    });

    res.json({ message: 'Si el correo está registrado recibirás el enlace en breve.' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// POST /api/auth/reset-password — valida token y actualiza contraseña
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: 'Token y contraseña son obligatorios' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT prt.id, prt.usuario_id, prt.expira_en, prt.usado
       FROM password_reset_tokens prt
       WHERE prt.token = ?`,
      [token]
    );

    if (!rows.length) {
      return res.status(400).json({ message: 'El enlace no es válido o ya ha sido utilizado.' });
    }

    const registro = rows[0];

    if (registro.usado) {
      return res.status(400).json({ message: 'Este enlace ya ha sido utilizado.' });
    }

    if (new Date() > new Date(registro.expira_en)) {
      return res.status(400).json({ message: 'El enlace ha caducado. Solicita uno nuevo.' });
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      'UPDATE usuarios SET password_hash = ?, fecha_actualizacion = NOW() WHERE id = ?',
      [hash, registro.usuario_id]
    );

    await pool.query(
      'UPDATE password_reset_tokens SET usado = 1 WHERE id = ?',
      [registro.id]
    );

    res.json({ message: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

module.exports = router;
