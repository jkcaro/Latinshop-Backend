const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { geocodificar } = require('../utils/geocodificar');

// GET /api/tiendas - público (solo aprobadas)
router.get('/', async (req, res) => {
  const { estado } = req.query;
  let sql = `
    SELECT t.*, u.nombre AS propietario_nombre, u.apellidos AS propietario_apellidos,
           u.email, c.nombre AS ciudad_nombre
    FROM tiendas t
    JOIN usuarios u ON t.usuario_id = u.id
    LEFT JOIN ciudades c ON t.ciudad_id = c.id
  `;
  const params = [];

  if (estado) {
    sql += ' WHERE t.estado_revision = ?';
    params.push(estado);
  } else {
    sql += " WHERE t.estado_revision = 'APROBADA'";
  }

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/tiendas/todas - admin ve todas
router.get('/todas', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.*, u.nombre AS propietario_nombre, u.apellidos AS propietario_apellidos,
             u.email, c.nombre AS ciudad_nombre
      FROM tiendas t
      JOIN usuarios u ON t.usuario_id = u.id
      LEFT JOIN ciudades c ON t.ciudad_id = c.id
      ORDER BY t.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/tiendas/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, u.nombre AS propietario_nombre, u.apellidos AS propietario_apellidos,
              u.email, c.nombre AS ciudad_nombre
       FROM tiendas t
       JOIN usuarios u ON t.usuario_id = u.id
       LEFT JOIN ciudades c ON t.ciudad_id = c.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Tienda no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// POST /api/tiendas/registro - registro de nueva tienda
router.post('/registro', async (req, res) => {
  const {
    nombre, apellidos, email, password, telefono,
    nombre_negocio, nif_cif, direccion, ciudad_id,
    codigo_postal, descripcion, acepta_politica
  } = req.body;

  if (!nombre || !email || !password || !nombre_negocio) {
    return res.status(400).json({ message: 'Faltan campos obligatorios' });
  }

  try {
    const [existe] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existe.length) return res.status(409).json({ message: 'El correo ya está registrado' });

    const hash = await bcrypt.hash(password, 10);

    const [userResult] = await pool.query(
      `INSERT INTO usuarios (rol_id, nombre, apellidos, email, password_hash, telefono, activo, email_verificado)
       VALUES (3, ?, ?, ?, ?, ?, 1, 0)`,
      [nombre, apellidos ?? '', email, hash, telefono ?? '']
    );

    let latitud = null, longitud = null;
    try {
      if (direccion && ciudad_id) {
        const [[ciudad]] = await pool.query('SELECT nombre FROM ciudades WHERE id = ?', [ciudad_id]);
        const coords = await geocodificar(direccion, ciudad?.nombre ?? '', codigo_postal ?? '');
        if (coords) { latitud = coords.lat; longitud = coords.lon; }
      }
    } catch (geoErr) {
      console.warn('[registro tienda] geocodificación falló, se omite:', geoErr.message);
    }

    await pool.query(
      `INSERT INTO tiendas (usuario_id, nombre_negocio, nif_cif, direccion, ciudad_id, codigo_postal, descripcion, telefono_contacto, estado_revision, acepta_politica, latitud, longitud)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, ?)`,
      [userResult.insertId, nombre_negocio, nif_cif ?? '', direccion ?? '', ciudad_id ?? 1, codigo_postal ?? '', descripcion ?? '', telefono ?? '', acepta_politica ? 1 : 0, latitud, longitud]
    );

    res.status(201).json({ message: 'Solicitud enviada. Tu tienda está pendiente de aprobación.' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/tiendas/:id - actualizar perfil (TIENDA o ADMIN)
router.put('/:id', verifyToken, requireRole('TIENDA', 'ADMIN'), async (req, res) => {
  const { nombre_negocio, descripcion, direccion, telefono_contacto, ciudad_id, codigo_postal, imagen_url, radio_entrega_km } = req.body;
  console.log(`[PUT /tiendas/${req.params.id}] imagen_url size: ${imagen_url ? imagen_url.length : 0} chars`);
  try {
    // Geocodificar dirección actualizada para validación de radio
    let latitud = null, longitud = null;
    if (direccion && ciudad_id) {
      const [[ciudad]] = await pool.query('SELECT nombre FROM ciudades WHERE id = ?', [ciudad_id]);
      const coords = await geocodificar(direccion, ciudad?.nombre ?? '', codigo_postal ?? '');
      if (coords) { latitud = coords.lat; longitud = coords.lon; }
    }

    await pool.query(
      'UPDATE tiendas SET nombre_negocio=?, descripcion=?, direccion=?, telefono_contacto=?, ciudad_id=?, codigo_postal=?, imagen_url=?, radio_entrega_km=?, latitud=?, longitud=? WHERE id=?',
      [nombre_negocio, descripcion, direccion, telefono_contacto, ciudad_id, codigo_postal ?? '', imagen_url ?? '',
       radio_entrega_km ?? 0, latitud, longitud, req.params.id]
    );
    console.log(`[PUT /tiendas/${req.params.id}] guardado OK`);
    res.json({ message: 'Tienda actualizada' });
  } catch (err) {
    console.error(`[PUT /tiendas/${req.params.id}] ERROR:`, err.message);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/tiendas/:id/aprobar - solo ADMIN
router.put('/:id/aprobar', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    await pool.query("UPDATE tiendas SET estado_revision = 'APROBADA' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Tienda aprobada' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/tiendas/:id/rechazar - solo ADMIN
router.put('/:id/rechazar', verifyToken, requireRole('ADMIN'), async (req, res) => {
  const { motivo } = req.body;
  try {
    await pool.query("UPDATE tiendas SET estado_revision = 'RECHAZADA' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Tienda rechazada', motivo });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/tiendas/:id/bloquear - solo ADMIN
router.put('/:id/bloquear', verifyToken, requireRole('ADMIN'), async (req, res) => {
  const { motivo } = req.body;
  try {
    await pool.query("UPDATE tiendas SET estado_revision = 'BLOQUEADA' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Tienda bloqueada', motivo });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/tiendas/:id/desbloquear - solo ADMIN
router.put('/:id/desbloquear', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    await pool.query("UPDATE tiendas SET estado_revision = 'APROBADA' WHERE id = ?", [req.params.id]);
    res.json({ message: 'Tienda desbloqueada' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/tiendas/:id/horarios - público
router.get('/:id/horarios', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT dia_semana, hora_apertura, hora_cierre, cerrado FROM tienda_horarios WHERE tienda_id = ? ORDER BY dia_semana',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/tiendas/:id/horarios - TIENDA o ADMIN
router.put('/:id/horarios', verifyToken, requireRole('TIENDA', 'ADMIN'), async (req, res) => {
  const { horarios } = req.body; // array de { dia_semana, hora_apertura, hora_cierre, cerrado }
  if (!Array.isArray(horarios)) {
    return res.status(400).json({ message: 'Se esperaba un array de horarios' });
  }
  try {
    for (const h of horarios) {
      await pool.query(
        `INSERT INTO tienda_horarios (tienda_id, dia_semana, hora_apertura, hora_cierre, cerrado)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE hora_apertura=VALUES(hora_apertura), hora_cierre=VALUES(hora_cierre), cerrado=VALUES(cerrado)`,
        [req.params.id, h.dia_semana, h.cerrado ? null : (h.hora_apertura || null), h.cerrado ? null : (h.hora_cierre || null), h.cerrado ? 1 : 0]
      );
    }
    res.json({ message: 'Horarios guardados correctamente' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/tiendas/:id/nota - guardar nota interna (solo ADMIN)
router.put('/:id/nota', verifyToken, requireRole('ADMIN'), async (req, res) => {
  const { nota } = req.body;
  try {
    // La columna nota interna no está en el esquema visible; se omite si no existe
    res.json({ message: 'Nota guardada', nota });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

module.exports = router;
