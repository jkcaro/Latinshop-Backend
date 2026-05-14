const router = require('express').Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

// GET /api/carrito/:clienteId
router.get('/:clienteId', verifyToken, async (req, res) => {
  try {
    const [carritos] = await pool.query(
      "SELECT * FROM carritos WHERE cliente_id = ? AND estado = 'ACTIVO'",
      [req.params.clienteId]
    );

    if (!carritos.length) return res.json({ carritoId: null, items: [] });

    const carrito = carritos[0];
    const [items] = await pool.query(
      `SELECT ci.*, p.nombre, p.precio, p.imagen_url, p.stock, p.tienda_id
       FROM carrito_items ci
       JOIN productos p ON ci.producto_id = p.id
       WHERE ci.carrito_id = ?`,
      [carrito.id]
    );

    res.json({ carritoId: carrito.id, items });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// POST /api/carrito/:clienteId/items - agregar o incrementar producto
router.post('/:clienteId/items', verifyToken, async (req, res) => {
  const { producto_id, cantidad } = req.body;
  if (!producto_id || !cantidad) {
    return res.status(400).json({ message: 'producto_id y cantidad son obligatorios' });
  }

  try {
    // Obtener o crear carrito activo
    let [carritos] = await pool.query(
      "SELECT id FROM carritos WHERE cliente_id = ? AND estado = 'ACTIVO'",
      [req.params.clienteId]
    );

    let carritoId;
    if (!carritos.length) {
      const [result] = await pool.query(
        "INSERT INTO carritos (cliente_id, estado) VALUES (?, 'ACTIVO')",
        [req.params.clienteId]
      );
      carritoId = result.insertId;
    } else {
      carritoId = carritos[0].id;
    }

    const [producto] = await pool.query('SELECT precio, stock FROM productos WHERE id = ? AND activo = 1', [producto_id]);
    if (!producto.length) return res.status(404).json({ message: 'Producto no encontrado o inactivo' });

    const precio = producto[0].precio;

    const [existe] = await pool.query(
      'SELECT id, cantidad FROM carrito_items WHERE carrito_id = ? AND producto_id = ?',
      [carritoId, producto_id]
    );

    if (existe.length) {
      const nuevaCantidad = existe[0].cantidad + cantidad;
      await pool.query(
        'UPDATE carrito_items SET cantidad=?, subtotal=?, precio_unitario=? WHERE id=?',
        [nuevaCantidad, (precio * nuevaCantidad).toFixed(2), precio, existe[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO carrito_items (carrito_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
        [carritoId, producto_id, cantidad, precio, (precio * cantidad).toFixed(2)]
      );
    }

    res.json({ message: 'Producto agregado al carrito' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/carrito/:clienteId/items/:productoId - actualizar cantidad
router.put('/:clienteId/items/:productoId', verifyToken, async (req, res) => {
  const { cantidad } = req.body;
  if (!cantidad || cantidad < 1) return res.status(400).json({ message: 'Cantidad inválida' });

  try {
    const [carritos] = await pool.query(
      "SELECT id FROM carritos WHERE cliente_id = ? AND estado = 'ACTIVO'",
      [req.params.clienteId]
    );
    if (!carritos.length) return res.status(404).json({ message: 'Carrito no encontrado' });

    const [producto] = await pool.query('SELECT precio FROM productos WHERE id = ?', [req.params.productoId]);
    if (!producto.length) return res.status(404).json({ message: 'Producto no encontrado' });

    await pool.query(
      'UPDATE carrito_items SET cantidad=?, subtotal=? WHERE carrito_id=? AND producto_id=?',
      [cantidad, (producto[0].precio * cantidad).toFixed(2), carritos[0].id, req.params.productoId]
    );

    res.json({ message: 'Cantidad actualizada' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// DELETE /api/carrito/:clienteId/items/:productoId - eliminar un producto
router.delete('/:clienteId/items/:productoId', verifyToken, async (req, res) => {
  try {
    const [carritos] = await pool.query(
      "SELECT id FROM carritos WHERE cliente_id = ? AND estado = 'ACTIVO'",
      [req.params.clienteId]
    );
    if (!carritos.length) return res.status(404).json({ message: 'Carrito no encontrado' });

    await pool.query(
      'DELETE FROM carrito_items WHERE carrito_id=? AND producto_id=?',
      [carritos[0].id, req.params.productoId]
    );

    res.json({ message: 'Producto eliminado del carrito' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// DELETE /api/carrito/:clienteId - vaciar carrito completo
router.delete('/:clienteId', verifyToken, async (req, res) => {
  try {
    const [carritos] = await pool.query(
      "SELECT id FROM carritos WHERE cliente_id = ? AND estado = 'ACTIVO'",
      [req.params.clienteId]
    );
    if (!carritos.length) return res.json({ message: 'Carrito ya estaba vacío' });

    await pool.query('DELETE FROM carrito_items WHERE carrito_id=?', [carritos[0].id]);
    await pool.query("UPDATE carritos SET estado='CERRADO' WHERE id=?", [carritos[0].id]);

    res.json({ message: 'Carrito vaciado' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

module.exports = router;
