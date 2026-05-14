const router = require('express').Router();
const pool = require('../db');

// GET /api/ciudades - público
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ciudades WHERE activa = 1 ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error del servidor', error: err.message });
  }
});

module.exports = router;
