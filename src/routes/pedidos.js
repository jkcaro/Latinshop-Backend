const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { geocodificar, haversineKm } = require('../utils/geocodificar');
const { enviarEmail, htmlConfirmacionPedido, htmlNuevoPedidoTienda, htmlCambioEstadoPedido } = require('../utils/email');

// GET /api/pedidos - filtrar por cliente_id o tienda_id
router.get('/', verifyToken, async (req, res) => {
  const { cliente_id, tienda_id } = req.query;

  let sql = `
    SELECT p.*,
           u.nombre AS cliente_nombre, u.email AS cliente_email,
           t.nombre_negocio AS tienda_nombre
    FROM pedidos p
    JOIN clientes c ON p.cliente_id = c.id
    JOIN usuarios u ON c.usuario_id = u.id
    JOIN tiendas t ON p.tienda_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (cliente_id) { sql += ' AND p.cliente_id = ?'; params.push(cliente_id); }
  if (tienda_id)  { sql += ' AND p.tienda_id = ?';  params.push(tienda_id); }

  sql += ' ORDER BY p.fecha_pedido DESC';

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/pedidos/:id - detalle completo de un pedido
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [pedidos] = await pool.query(
      `SELECT p.*, u.nombre AS cliente_nombre, u.email AS cliente_email, t.nombre_negocio AS tienda_nombre
       FROM pedidos p
       JOIN clientes c ON p.cliente_id = c.id
       JOIN usuarios u ON c.usuario_id = u.id
       JOIN tiendas t ON p.tienda_id = t.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!pedidos.length) return res.status(404).json({ message: 'Pedido no encontrado' });

    const [items]    = await pool.query(
      `SELECT dp.*, p.imagen_url
       FROM detalle_pedidos dp
       LEFT JOIN productos p ON dp.producto_id = p.id
       WHERE dp.pedido_id = ?`,
      [req.params.id]
    );
    const [historial]= await pool.query('SELECT * FROM pedido_estados_historial WHERE pedido_id = ? ORDER BY fecha', [req.params.id]);
    const [pagos]    = await pool.query('SELECT * FROM pagos WHERE pedido_id = ?', [req.params.id]);

    res.json({ ...pedidos[0], items, historial, pago: pagos[0] ?? null });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// POST /api/pedidos - crear pedido (solo CLIENTE)
router.post('/', verifyToken, requireRole('CLIENTE'), async (req, res) => {
  const {
    cliente_id, tienda_id,
    direccion_envio, ciudad_envio, codigo_postal_envio,
    metodo_pago, metodo_envio, observaciones,
    acepta_condiciones_compra,
    items
  } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ message: 'El pedido debe tener al menos un producto' });
  }

  if (!acepta_condiciones_compra) {
    return res.status(400).json({ message: 'Debes aceptar la política de privacidad y las condiciones de compra para realizar un pedido' });
  }

  // Validar radio de entrega antes de abrir transacción
  if (metodo_envio !== 'RECOGIDA_TIENDA') {
    try {
      const [[tienda]] = await pool.query(
        'SELECT radio_entrega_km, latitud, longitud, nombre_negocio FROM tiendas WHERE id = ?',
        [tienda_id]
      );
      if (tienda && tienda.radio_entrega_km > 0 && tienda.latitud && tienda.longitud) {
        const coordsCliente = await geocodificar(direccion_envio, ciudad_envio, codigo_postal_envio);
        if (coordsCliente) {
          const distancia = haversineKm(tienda.latitud, tienda.longitud, coordsCliente.lat, coordsCliente.lon);
          if (distancia > tienda.radio_entrega_km) {
            return res.status(400).json({
              message: `Tu dirección está a ${Math.round(distancia)} km de "${tienda.nombre_negocio}". Esta tienda solo entrega en un radio de ${tienda.radio_entrega_km} km.`,
              distancia: Math.round(distancia),
              radioTienda: tienda.radio_entrega_km
            });
          }
        }
      }
    } catch (e) {
      console.warn('[pedidos] validación radio falló, se omite:', e.message);
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const subtotal = items.reduce((acc, item) => acc + (item.precio_unitario * item.cantidad), 0);
    const costo_envio = metodo_envio === 'EXPRESS' ? 5.5 : metodo_envio === 'RECOGIDA_TIENDA' ? 0 : 2.5;
    const iva   = Number((subtotal * 0.21).toFixed(2));
    const total = Number((subtotal + costo_envio + iva).toFixed(2));

    const [[countRow]] = await conn.query('SELECT COUNT(*) AS cnt FROM pedidos');
    const numero_pedido = `PED-${String(countRow.cnt + 1).padStart(4, '0')}`;

    const [pedidoResult] = await conn.query(
      `INSERT INTO pedidos (cliente_id, tienda_id, numero_pedido, estado, direccion_envio, ciudad_envio, codigo_postal_envio, subtotal, costo_envio, iva, total, observaciones, acepta_condiciones_compra, metodo_envio)
       VALUES (?, ?, ?, 'PENDIENTE', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [cliente_id, tienda_id, numero_pedido, direccion_envio, ciudad_envio, codigo_postal_envio,
       subtotal.toFixed(2), costo_envio, iva, total, observaciones ?? '', metodo_envio ?? 'ESTANDAR']
    );

    const pedidoId = pedidoResult.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO detalle_pedidos (pedido_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pedidoId, item.producto_id, item.nombre_producto, item.precio_unitario, item.cantidad,
         (item.precio_unitario * item.cantidad).toFixed(2)]
      );
    }

    await conn.query(
      `INSERT INTO pedido_estados_historial (pedido_id, estado, comentario)
       VALUES (?, 'PENDIENTE', 'Pedido creado correctamente')`,
      [pedidoId]
    );

    await conn.query(
      `INSERT INTO pagos (pedido_id, metodo_pago, estado_pago, monto, moneda, referencia_externa, proveedor_pago)
       VALUES (?, ?, 'PAGADO', ?, 'EUR', ?, 'Stripe')`,
      [pedidoId, metodo_pago, total, `TXN-${Date.now()}`]
    );

    await conn.commit();

    // Emails asíncronos (no bloquean la respuesta)
    setImmediate(async () => {
      try {
        // Datos completos para los emails
        const [[clienteRow]] = await pool.query(
          `SELECT u.nombre, u.email
           FROM clientes c JOIN usuarios u ON c.usuario_id = u.id
           WHERE c.id = ?`,
          [cliente_id]
        );
        const [[tiendaRow]] = await pool.query(
          `SELECT t.nombre_negocio, u.email AS email_tienda
           FROM tiendas t JOIN usuarios u ON t.usuario_id = u.id
           WHERE t.id = ?`,
          [tienda_id]
        );

        const datosPedido = {
          numero_pedido: numero_pedido,
          subtotal, costo_envio, iva, total,
          direccion_envio,
          ciudad_envio,
          metodo_pago,
          items
        };

        // Email de confirmación al cliente
        await enviarEmail({
          to: clienteRow.email,
          subject: `Pedido ${numero_pedido} confirmado — LatinShop España`,
          html: htmlConfirmacionPedido(clienteRow.nombre, datosPedido)
        });

        // Notificación a la tienda
        await enviarEmail({
          to: tiendaRow.email_tienda,
          subject: `Nuevo pedido recibido: ${numero_pedido}`,
          html: htmlNuevoPedidoTienda(tiendaRow.nombre_negocio, {
            ...datosPedido,
            cliente_nombre: clienteRow.nombre,
            cliente_email: clienteRow.email
          })
        });
      } catch (e) {
        console.error('[pedidos] Error enviando emails de confirmación:', e.message);
      }
    });

    res.status(201).json({ message: 'Pedido creado correctamente', pedidoId, numeroPedido: numero_pedido, total });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  } finally {
    conn.release();
  }
});

// PUT /api/pedidos/:id/estado - cambiar estado (TIENDA o ADMIN)
router.put('/:id/estado', verifyToken, requireRole('TIENDA', 'ADMIN'), async (req, res) => {
  const { estado, comentario } = req.body;
  if (!estado) return res.status(400).json({ message: 'El campo estado es obligatorio' });

  try {
    await pool.query('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);
    await pool.query(
      'INSERT INTO pedido_estados_historial (pedido_id, estado, comentario) VALUES (?, ?, ?)',
      [req.params.id, estado, comentario ?? '']
    );

    // Notificar al cliente por email (solo para estados relevantes)
    const estadosNotificables = ['CONFIRMADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
    if (estadosNotificables.includes(estado)) {
      setImmediate(async () => {
        try {
          const [[pedidoRow]] = await pool.query(
            `SELECT p.numero_pedido, u.nombre, u.email
             FROM pedidos p
             JOIN clientes c ON p.cliente_id = c.id
             JOIN usuarios u ON c.usuario_id = u.id
             WHERE p.id = ?`,
            [req.params.id]
          );
          if (pedidoRow) {
            await enviarEmail({
              to: pedidoRow.email,
              subject: `Actualización de tu pedido ${pedidoRow.numero_pedido} — LatinShop España`,
              html: htmlCambioEstadoPedido(pedidoRow.nombre, pedidoRow, estado)
            });
          }
        } catch (e) {
          console.error('[pedidos] Error enviando email de estado:', e.message);
        }
      });
    }

    res.json({ message: 'Estado del pedido actualizado' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

module.exports = router;
