const router = require('express').Router();
const pool   = require('../db');
const { verifyToken } = require('../middleware/auth');

async function verificarAcceso(req, res, pedidoId) {
  const [[pedido]] = await pool.query(
    'SELECT cliente_id, tienda_id FROM pedidos WHERE id = ?',
    [pedidoId]
  );
  if (!pedido) {
    res.status(404).json({ message: 'Pedido no encontrado' });
    return null;
  }
  const { rol, clienteId, tiendaId } = req.user;
  if (rol === 'CLIENTE' && pedido.cliente_id !== clienteId) {
    res.status(403).json({ message: 'Sin acceso a este pedido' });
    return null;
  }
  if (rol === 'TIENDA' && pedido.tienda_id !== tiendaId) {
    res.status(403).json({ message: 'Sin acceso a este pedido' });
    return null;
  }
  return pedido;
}

// GET /api/mensajes/pedido/:pedidoId
router.get('/pedido/:pedidoId', verifyToken, async (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  try {
    const pedido = await verificarAcceso(req, res, pedidoId);
    if (!pedido) return;

    const [mensajes] = await pool.query(
      'SELECT * FROM mensajes WHERE pedido_id = ? ORDER BY fecha_envio ASC',
      [pedidoId]
    );
    res.json(mensajes);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// POST /api/mensajes/pedido/:pedidoId
router.post('/pedido/:pedidoId', verifyToken, async (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  const { contenido } = req.body;

  if (!contenido?.trim()) {
    return res.status(400).json({ message: 'El contenido no puede estar vacío' });
  }

  try {
    const pedido = await verificarAcceso(req, res, pedidoId);
    if (!pedido) return;

    const { rol, clienteId, tiendaId } = req.user;
    const remitenteTipo = rol === 'CLIENTE' ? 'CLIENTE' : 'TIENDA';
    const remitenteId   = rol === 'CLIENTE' ? clienteId : tiendaId;

    const [result] = await pool.query(
      'INSERT INTO mensajes (pedido_id, remitente_tipo, remitente_id, contenido) VALUES (?, ?, ?, ?)',
      [pedidoId, remitenteTipo, remitenteId, contenido.trim()]
    );

    const [[nuevo]] = await pool.query('SELECT * FROM mensajes WHERE id = ?', [result.insertId]);
    res.status(201).json(nuevo);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PATCH /api/mensajes/pedido/:pedidoId/leer
// Marca como leídos los mensajes del otro participante (los que aún no ha visto el solicitante)
router.patch('/pedido/:pedidoId/leer', verifyToken, async (req, res) => {
  const pedidoId = Number(req.params.pedidoId);
  try {
    const pedido = await verificarAcceso(req, res, pedidoId);
    if (!pedido) return;

    const tipoContrario = req.user.rol === 'CLIENTE' ? 'TIENDA' : 'CLIENTE';
    await pool.query(
      'UPDATE mensajes SET leido = 1 WHERE pedido_id = ? AND remitente_tipo = ? AND leido = 0',
      [pedidoId, tipoContrario]
    );
    res.json({ message: 'Mensajes marcados como leídos' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

module.exports = router;
