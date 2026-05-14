require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:4200'];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o.trim()))) cb(null, true);
    else cb(new Error('CORS: origen no permitido'));
  }
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/productos',  require('./routes/productos'));
app.use('/api/tiendas',    require('./routes/tiendas'));
app.use('/api/pedidos',    require('./routes/pedidos'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/carrito',    require('./routes/carrito'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/ciudades',   require('./routes/ciudades'));
app.use('/api/resenas',    require('./routes/resenas'));
app.use('/api/mensajes',   require('./routes/mensajes'));

app.get('/api/health', (req, res) => res.json({ ok: true, message: 'API LatinShop funcionando' }));

app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API LatinShop escuchando en http://localhost:${PORT}`);
});
