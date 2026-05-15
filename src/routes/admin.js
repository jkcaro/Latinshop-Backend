const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// Todos los endpoints de este router requieren rol ADMIN
router.use(verifyToken, requireRole('ADMIN'));

// GET /api/admin/dashboard - resumen general
router.get('/dashboard', async (req, res) => {
  try {
    const [[{ total_pedidos }]]    = await pool.query('SELECT COUNT(*) AS total_pedidos FROM pedidos');
    const [[{ total_ventas }]]     = await pool.query('SELECT COALESCE(SUM(total), 0) AS total_ventas FROM pedidos');
    const [[{ total_productos }]]  = await pool.query('SELECT COUNT(*) AS total_productos FROM productos WHERE activo = 1');
    const [[{ total_clientes }]]   = await pool.query('SELECT COUNT(*) AS total_clientes FROM clientes');
    const [[{ tiendas_pendientes }]] = await pool.query("SELECT COUNT(*) AS tiendas_pendientes FROM tiendas WHERE estado_revision = 'PENDIENTE'");
    const [[{ total_tiendas }]]    = await pool.query("SELECT COUNT(*) AS total_tiendas FROM tiendas WHERE estado_revision = 'APROBADA'");

    res.json({
      total_pedidos,
      total_ventas: Number(total_ventas),
      total_productos,
      total_clientes,
      tiendas_pendientes,
      total_tiendas
    });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/admin/usuarios - todos los usuarios
router.get('/usuarios', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.nombre, u.apellidos, u.email, u.telefono,
             u.activo, u.email_verificado, u.fecha_creacion,
             u.foto_perfil AS fotoPerfil,
             r.nombre AS rol,
             c.id AS clienteId,
             c.direccion,
             c.ciudad_id AS ciudadId,
             ci.nombre AS ciudadNombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN clientes c ON c.usuario_id = u.id
      LEFT JOIN ciudades ci ON ci.id = c.ciudad_id
      ORDER BY u.fecha_creacion DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/admin/usuarios/:id/estado - bloquear/desbloquear usuario
router.put('/usuarios/:id/estado', async (req, res) => {
  try {
    await pool.query(
      'UPDATE usuarios SET activo = NOT activo, fecha_actualizacion = NOW() WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Estado del usuario actualizado' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/admin/pedidos - todos los pedidos con detalle
router.get('/pedidos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, u.nombre AS cliente_nombre, u.email AS cliente_email,
             t.nombre_negocio AS tienda_nombre
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN tiendas t ON p.tienda_id = t.id
      ORDER BY p.fecha_pedido DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/admin/reporte-ventas - vista de reporte
router.get('/reporte-ventas', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vw_reporte_ventas');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/admin/productos - todos los productos incluyendo inactivos
router.get('/productos', async (req, res) => {
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

module.exports = router;
