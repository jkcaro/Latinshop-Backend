const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/resenas/tienda/:tiendaId — reseñas visibles (público)
router.get('/tienda/:tiendaId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.calificacion, r.comentario, r.fecha, r.estado,
              u.nombre AS cliente_nombre
       FROM resenas_tienda r
       JOIN clientes c ON r.cliente_id = c.id
       JOIN usuarios u ON c.usuario_id = u.id
       WHERE r.tienda_id = ? AND r.estado = 'VISIBLE'
       ORDER BY r.fecha DESC
       LIMIT 50`,
      [req.params.tiendaId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/resenas/tienda/:tiendaId/stats — estadísticas de calificación
router.get('/tienda/:tiendaId/stats', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         IFNULL(AVG(calificacion), 0) AS promedio,
         SUM(calificacion = 5) AS estrellas5,
         SUM(calificacion = 4) AS estrellas4,
         SUM(calificacion = 3) AS estrellas3,
         SUM(calificacion = 2) AS estrellas2,
         SUM(calificacion = 1) AS estrellas1
       FROM resenas_tienda
       WHERE tienda_id = ? AND estado = 'VISIBLE'`,
      [req.params.tiendaId]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/resenas/puede/:tiendaId — ¿puede el cliente reseñar esta tienda?
router.get('/puede/:tiendaId', verifyToken, requireRole('CLIENTE'), async (req, res) => {
  try {
    const [clientes] = await pool.query(
      'SELECT id FROM clientes WHERE usuario_id = ?', [req.user.id]
    );
    if (!clientes.length) return res.json({ puede: false, pedidoId: null });

    const clienteId = clientes[0].id;

    const [pedidos] = await pool.query(
      `SELECT p.id FROM pedidos p
       WHERE p.cliente_id = ? AND p.tienda_id = ? AND p.estado = 'ENTREGADO'
         AND NOT EXISTS (
           SELECT 1 FROM resenas_tienda r WHERE r.pedido_id = p.id
         )
       LIMIT 1`,
      [clienteId, req.params.tiendaId]
    );

    res.json({ puede: pedidos.length > 0, pedidoId: pedidos[0]?.id ?? null });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/resenas/mis-resenas — reseñas del cliente autenticado
router.get('/mis-resenas', verifyToken, requireRole('CLIENTE'), async (req, res) => {
  try {
    const [clientes] = await pool.query(
      'SELECT id FROM clientes WHERE usuario_id = ?', [req.user.id]
    );
    if (!clientes.length) return res.json([]);

    const [rows] = await pool.query(
      `SELECT r.*, t.nombre_negocio AS tienda_nombre
       FROM resenas_tienda r
       JOIN tiendas t ON r.tienda_id = t.id
       WHERE r.cliente_id = ?
       ORDER BY r.fecha DESC`,
      [clientes[0].id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/resenas/admin/todas — todas las reseñas (admin)
router.get('/admin/todas', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.nombre AS cliente_nombre, t.nombre_negocio AS tienda_nombre
       FROM resenas_tienda r
       JOIN clientes c ON r.cliente_id = c.id
       JOIN usuarios u ON c.usuario_id = u.id
       JOIN tiendas t ON r.tienda_id = t.id
       ORDER BY r.fecha DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// POST /api/resenas — crear reseña (CLIENTE)
router.post('/', verifyToken, requireRole('CLIENTE'), async (req, res) => {
  const { tienda_id, pedido_id, calificacion, comentario } = req.body;

  if (!calificacion || calificacion < 1 || calificacion > 5) {
    return res.status(400).json({ message: 'La calificación debe ser entre 1 y 5 estrellas.' });
  }
  if (!tienda_id || !pedido_id) {
    return res.status(400).json({ message: 'Faltan datos obligatorios.' });
  }

  try {
    const [clientes] = await pool.query(
      'SELECT id FROM clientes WHERE usuario_id = ?', [req.user.id]
    );
    if (!clientes.length) return res.status(403).json({ message: 'Cliente no encontrado.' });
    const clienteId = clientes[0].id;

    // Verificar pedido entregado del cliente en esta tienda
    const [pedidos] = await pool.query(
      `SELECT id FROM pedidos
       WHERE id = ? AND cliente_id = ? AND tienda_id = ? AND estado = 'ENTREGADO'`,
      [pedido_id, clienteId, tienda_id]
    );
    if (!pedidos.length) {
      return res.status(403).json({ message: 'Solo puedes reseñar tiendas con pedidos entregados.' });
    }

    // Evitar duplicados por pedido
    const [existente] = await pool.query(
      'SELECT id FROM resenas_tienda WHERE pedido_id = ?', [pedido_id]
    );
    if (existente.length) {
      return res.status(409).json({ message: 'Ya existe una reseña para este pedido.' });
    }

    const [result] = await pool.query(
      `INSERT INTO resenas_tienda (tienda_id, cliente_id, pedido_id, calificacion, comentario)
       VALUES (?, ?, ?, ?, ?)`,
      [tienda_id, clienteId, pedido_id, calificacion, comentario?.trim() || null]
    );

    res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// DELETE /api/resenas/:id — eliminar reseña (propia cliente o admin)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.rol === 'ADMIN') {
      await pool.query('DELETE FROM resenas_tienda WHERE id = ?', [req.params.id]);
      return res.json({ ok: true });
    }

    const [clientes] = await pool.query(
      'SELECT id FROM clientes WHERE usuario_id = ?', [req.user.id]
    );
    if (!clientes.length) return res.status(403).json({ message: 'Acceso denegado.' });

    const [result] = await pool.query(
      'DELETE FROM resenas_tienda WHERE id = ? AND cliente_id = ?',
      [req.params.id, clientes[0].id]
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Reseña no encontrada.' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/resenas/:id/estado — cambiar estado visible/oculta (admin)
router.put('/:id/estado', verifyToken, requireRole('ADMIN'), async (req, res) => {
  const { estado } = req.body;
  if (!['VISIBLE', 'OCULTA'].includes(estado)) {
    return res.status(400).json({ message: 'Estado inválido.' });
  }
  try {
    await pool.query(
      'UPDATE resenas_tienda SET estado = ? WHERE id = ?', [estado, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

module.exports = router;
