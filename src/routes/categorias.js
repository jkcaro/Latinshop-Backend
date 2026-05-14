const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/categorias - público
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categorias WHERE activa = 1 ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// GET /api/categorias/todas - solo admin (incluye inactivas)
router.get('/todas', verifyToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categorias ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// POST /api/categorias
router.post('/', verifyToken, requireRole('ADMIN'), async (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ message: 'El nombre es obligatorio' });

  try {
    const [result] = await pool.query(
      'INSERT INTO categorias (nombre, descripcion, activa) VALUES (?, ?, 1)',
      [nombre, descripcion ?? '']
    );
    res.status(201).json({ message: 'Categoría creada', id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

// PUT /api/categorias/:id
router.put('/:id', verifyToken, requireRole('ADMIN'), async (req, res) => {
  const { nombre, descripcion, activa } = req.body;
  try {
    await pool.query(
      'UPDATE categorias SET nombre=?, descripcion=?, activa=? WHERE id=?',
      [nombre, descripcion, activa ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Categoría actualizada' });
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

module.exports = router;
