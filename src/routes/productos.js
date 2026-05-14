const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/productos - público
router.get('/', async (req, res) => {
  const { tienda_id, categoria_id, destacados } = req.query;

  let sql = `
    SELECT p.*, c.nombre AS categoria_nombre, t.nombre_negocio AS tienda_nombre
    FROM productos p
    JOIN categorias c ON p.categoria_id = c.id
    JOIN tiendas t ON p.tienda_id = t.id
    WHERE p.activo = 1
  `;
  const params = [];

  if (tienda_id)         { sql += ' AND p.tienda_id = ?';    params.push(tienda_id); }
  if (categoria_id)      { sql += ' AND p.categoria_id = ?'; params.push(categoria_id); }
  if (destacados === 'true') { sql += ' AND p.destacado = 1'; }

  sql += ' ORDER BY p.fecha_creacion DESC';

  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/productos/todos - admin ve todos incluyendo inactivos
router.get('/todos', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, c.nombre AS categoria_nombre, t.nombre_negocio AS tienda_nombre
      FROM productos p
      JOIN categorias c ON p.categoria_id = c.id
      JOIN tiendas t ON p.tienda_id = t.id
      ORDER BY p.fecha_creacion DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/productos/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.nombre AS categoria_nombre, t.nombre_negocio AS tienda_nombre
       FROM productos p
       JOIN categorias c ON p.categoria_id = c.id
       JOIN tiendas t ON p.tienda_id = t.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// POST /api/productos - solo TIENDA o ADMIN
router.post('/', verifyToken, requireRole('TIENDA', 'ADMIN'), async (req, res) => {
  const { tienda_id, categoria_id, nombre, marca, pais_origen, descripcion, precio, precio_oferta, stock, imagen_url, destacado } = req.body;
  if (!nombre || !precio || !tienda_id || !categoria_id) {
    return res.status(400).json({ message: 'Faltan campos obligatorios: nombre, precio, tienda_id, categoria_id' });
  }

  const oferta = precio_oferta && Number(precio_oferta) > 0 && Number(precio_oferta) < Number(precio)
    ? Number(precio_oferta) : null;

  try {
    const [result] = await pool.query(
      `INSERT INTO productos (tienda_id, categoria_id, nombre, marca, pais_origen, descripcion, precio, precio_oferta, stock, imagen_url, activo, destacado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [tienda_id, categoria_id, nombre, marca ?? '', pais_origen ?? '', descripcion ?? '', precio, oferta, stock ?? 0, imagen_url ?? '', destacado ? 1 : 0]
    );
    res.status(201).json({ message: 'Producto creado', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/productos/:id
router.put('/:id', verifyToken, requireRole('TIENDA', 'ADMIN'), async (req, res) => {
  const { nombre, marca, precio, precio_oferta, categoria_id, pais_origen, descripcion, stock, imagen_url, destacado } = req.body;

  const oferta = precio_oferta && Number(precio_oferta) > 0 && Number(precio_oferta) < Number(precio)
    ? Number(precio_oferta) : null;

  try {
    await pool.query(
      `UPDATE productos
       SET nombre=?, marca=?, precio=?, precio_oferta=?, categoria_id=?, pais_origen=?, descripcion=?, stock=?, imagen_url=?, destacado=?, fecha_actualizacion=NOW()
       WHERE id=?`,
      [nombre, marca, precio, oferta, categoria_id, pais_origen, descripcion, stock, imagen_url, destacado ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Producto actualizado' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PATCH /api/productos/:id/oferta - solo actualiza precio_oferta
router.patch('/:id/oferta', verifyToken, requireRole('TIENDA', 'ADMIN'), async (req, res) => {
  const { precio_oferta } = req.body;
  try {
    const [rows] = await pool.query('SELECT precio FROM productos WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Producto no encontrado' });

    const oferta = precio_oferta && Number(precio_oferta) > 0 && Number(precio_oferta) < Number(rows[0].precio)
      ? Number(precio_oferta) : null;

    await pool.query(
      'UPDATE productos SET precio_oferta = ?, fecha_actualizacion = NOW() WHERE id = ?',
      [oferta, req.params.id]
    );
    res.json({ message: 'Oferta actualizada', precio_oferta: oferta });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PATCH /api/productos/:id/estado - activar/desactivar
router.patch('/:id/estado', verifyToken, requireRole('TIENDA', 'ADMIN'), async (req, res) => {
  try {
    await pool.query('UPDATE productos SET activo = NOT activo, fecha_actualizacion=NOW() WHERE id = ?', [req.params.id]);
    res.json({ message: 'Estado del producto actualizado' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// DELETE /api/productos/:id
router.delete('/:id', verifyToken, requireRole('TIENDA', 'ADMIN'), async (req, res) => {
  try {
    await pool.query('DELETE FROM productos WHERE id = ?', [req.params.id]);
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

module.exports = router;
