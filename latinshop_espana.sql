-- =====================================================
--  LatinShop España — Script de restauración completa
--  Ejecutar en phpMyAdmin o MySQL CLI
-- =====================================================

DROP DATABASE IF EXISTS latinshop_espana;
CREATE DATABASE latinshop_espana
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE latinshop_espana;

-- ---------------------------------------------------
-- TABLAS (orden respeta claves foráneas)
-- ---------------------------------------------------

CREATE TABLE roles (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE ciudades (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  activa TINYINT(1) DEFAULT 1
);

CREATE TABLE usuarios (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  rol_id            INT NOT NULL,
  nombre            VARCHAR(100) NOT NULL,
  apellidos         VARCHAR(100) DEFAULT '',
  email             VARCHAR(150) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  telefono          VARCHAR(20)  DEFAULT '',
  foto_perfil       MEDIUMTEXT   DEFAULT NULL,
  activo            TINYINT(1)   DEFAULT 1,
  email_verificado  TINYINT(1)   DEFAULT 0,
  fecha_creacion    DATETIME     DEFAULT NOW(),
  fecha_actualizacion DATETIME   DEFAULT NOW(),
  FOREIGN KEY (rol_id) REFERENCES roles(id)
);

CREATE TABLE clientes (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id               INT NOT NULL UNIQUE,
  direccion                VARCHAR(255) DEFAULT '',
  ciudad_id                INT,
  codigo_postal            VARCHAR(10)  DEFAULT '',
  acepta_privacidad        TINYINT(1)   NOT NULL DEFAULT 0,
  fecha_acepta_privacidad  DATETIME     DEFAULT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (ciudad_id)  REFERENCES ciudades(id)
);

CREATE TABLE tiendas (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id        INT NOT NULL,
  nombre_negocio    VARCHAR(150) NOT NULL,
  nif_cif           VARCHAR(20)  DEFAULT '',
  direccion         VARCHAR(255) DEFAULT '',
  ciudad_id         INT,
  codigo_postal     VARCHAR(10)  DEFAULT '',
  descripcion       TEXT,
  telefono_contacto VARCHAR(20)  DEFAULT '',
  estado_revision   ENUM('PENDIENTE','APROBADA','RECHAZADA','BLOQUEADA') DEFAULT 'PENDIENTE',
  acepta_politica   TINYINT(1)   DEFAULT 0,
  imagen_url        MEDIUMTEXT,
  radio_entrega_km  INT           DEFAULT 0,
  latitud           DECIMAL(10,8) DEFAULT NULL,
  longitud          DECIMAL(11,8) DEFAULT NULL,
  fecha_creacion    DATETIME     DEFAULT NOW(),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  FOREIGN KEY (ciudad_id)  REFERENCES ciudades(id)
);

CREATE TABLE categorias (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255) DEFAULT '',
  activa      TINYINT(1)   DEFAULT 1
);

CREATE TABLE productos (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  tienda_id           INT NOT NULL,
  categoria_id        INT NOT NULL,
  nombre              VARCHAR(150) NOT NULL,
  marca               VARCHAR(100) DEFAULT '',
  pais_origen         VARCHAR(100) DEFAULT '',
  descripcion         TEXT,
  precio              DECIMAL(10,2) NOT NULL,
  precio_oferta       DECIMAL(10,2) DEFAULT NULL,
  stock               INT           DEFAULT 0,
  imagen_url          MEDIUMTEXT,
  activo              TINYINT(1)    DEFAULT 1,
  destacado           TINYINT(1)    DEFAULT 0,
  fecha_creacion      DATETIME      DEFAULT NOW(),
  fecha_actualizacion DATETIME      DEFAULT NOW(),
  FOREIGN KEY (tienda_id)    REFERENCES tiendas(id),
  FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

CREATE TABLE carritos (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id     INT NOT NULL,
  estado         ENUM('ACTIVO','CERRADO') DEFAULT 'ACTIVO',
  fecha_creacion DATETIME DEFAULT NOW(),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE carrito_items (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  carrito_id     INT NOT NULL,
  producto_id    INT NOT NULL,
  cantidad       INT           NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal       DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (carrito_id)  REFERENCES carritos(id),
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);

CREATE TABLE pedidos (
  id                         INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id                 INT NOT NULL,
  tienda_id                  INT NOT NULL,
  numero_pedido              VARCHAR(20) NOT NULL UNIQUE,
  estado                     ENUM('PENDIENTE','CONFIRMADO','EN_PREPARACION','ENVIADO','ENTREGADO','CANCELADO') DEFAULT 'PENDIENTE',
  direccion_envio            VARCHAR(255) DEFAULT '',
  ciudad_envio               VARCHAR(100) DEFAULT '',
  codigo_postal_envio        VARCHAR(10)  DEFAULT '',
  subtotal                   DECIMAL(10,2) DEFAULT 0,
  costo_envio                DECIMAL(10,2) DEFAULT 0,
  iva                        DECIMAL(10,2) DEFAULT 0,
  total                      DECIMAL(10,2) DEFAULT 0,
  observaciones              TEXT,
  acepta_condiciones_compra  TINYINT(1)   NOT NULL DEFAULT 0,
  fecha_pedido               DATETIME DEFAULT NOW(),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (tienda_id)  REFERENCES tiendas(id)
);

CREATE TABLE tienda_horarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tienda_id     INT NOT NULL,
  dia_semana    TINYINT NOT NULL COMMENT '0=Lunes 1=Martes 2=Miercoles 3=Jueves 4=Viernes 5=Sabado 6=Domingo',
  hora_apertura TIME DEFAULT NULL,
  hora_cierre   TIME DEFAULT NULL,
  cerrado       TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_tienda_dia (tienda_id, dia_semana),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id) ON DELETE CASCADE
);

CREATE TABLE detalle_pedidos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id       INT NOT NULL,
  producto_id     INT,
  nombre_producto VARCHAR(150) NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  cantidad        INT           NOT NULL DEFAULT 1,
  subtotal        DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
);

CREATE TABLE pedido_estados_historial (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id  INT NOT NULL,
  estado     VARCHAR(50) NOT NULL,
  comentario TEXT,
  fecha      DATETIME DEFAULT NOW(),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
);

CREATE TABLE pagos (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  pedido_id          INT NOT NULL UNIQUE,
  metodo_pago        VARCHAR(50)  DEFAULT '',
  estado_pago        VARCHAR(50)  DEFAULT 'PENDIENTE',
  monto              DECIMAL(10,2) NOT NULL,
  moneda             VARCHAR(10)   DEFAULT 'EUR',
  referencia_externa VARCHAR(100)  DEFAULT '',
  proveedor_pago     VARCHAR(50)   DEFAULT '',
  fecha_pago         DATETIME DEFAULT NOW(),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id)
);

CREATE TABLE password_reset_tokens (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id     INT NOT NULL,
  token          VARCHAR(64) NOT NULL UNIQUE,
  expira_en      DATETIME NOT NULL,
  usado          TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion DATETIME DEFAULT NOW(),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_usuario (usuario_id)
);

CREATE TABLE consentimientos_cookies (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id             INT          DEFAULT NULL,
  ip_hash                VARCHAR(64)  DEFAULT '',
  necesarias             TINYINT(1)   NOT NULL DEFAULT 1,
  analiticas             TINYINT(1)   NOT NULL DEFAULT 0,
  marketing              TINYINT(1)   NOT NULL DEFAULT 0,
  fecha_consentimiento   DATETIME     DEFAULT NOW(),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- Vista de reporte de ventas
CREATE OR REPLACE VIEW vw_reporte_ventas AS
SELECT
  t.nombre_negocio  AS tienda,
  p.numero_pedido,
  p.estado,
  p.subtotal,
  p.costo_envio,
  p.iva,
  p.total,
  p.fecha_pedido,
  u.nombre          AS cliente_nombre,
  u.apellidos       AS cliente_apellidos,
  u.email           AS cliente_email
FROM pedidos p
JOIN tiendas  t ON p.tienda_id  = t.id
JOIN clientes c ON p.cliente_id = c.id
JOIN usuarios u ON c.usuario_id = u.id;

-- ---------------------------------------------------
-- DATOS INICIALES (seed)
-- ---------------------------------------------------

-- Roles
INSERT INTO roles (id, nombre) VALUES
  (1, 'ADMIN'),
  (2, 'CLIENTE'),
  (3, 'TIENDA');

-- Ciudades españolas
INSERT INTO ciudades (id, nombre, activa) VALUES
  (1,  'Madrid',       1),
  (2,  'Barcelona',    1),
  (3,  'Valencia',     1),
  (4,  'Sevilla',      1),
  (5,  'Bilbao',       1),
  (6,  'Málaga',       1),
  (7,  'Zaragoza',     1),
  (8,  'Alicante',     1),
  (9,  'Murcia',       1),
  (10, 'Las Palmas',   1),
  (11, 'Valladolid',   1),
  (12, 'Santander',    1),
  (13, 'Salamanca',    1),
  (14, 'Granada',      1),
  (15, 'Córdoba',      1);

-- =======================================================
-- Usuarios
-- Contraseñas (texto plano, soportado por auth.js en dev):
--   admin@latinshop.com  →  admin123
--   maria@latinshop.com  →  hash_demo_123
--   carlos@latinshop.com →  hash_demo_456
-- =======================================================
INSERT INTO usuarios (id, rol_id, nombre, apellidos, email, password_hash, telefono, activo, email_verificado, fecha_creacion) VALUES
  (1, 1, 'Admin',  'LatinShop', 'admin@latinshop.com',  'admin123',      '600000000', 1, 1, '2026-03-22 14:00:00'),
  (2, 2, 'María',  'Gómez',     'maria@latinshop.com',  'hash_demo_123', '600111222', 1, 1, '2026-03-22 14:46:52'),
  (3, 3, 'Carlos', 'Pérez',     'carlos@latinshop.com', 'hash_demo_456', '600333444', 1, 1, '2026-03-22 14:48:48');

-- Cliente: María (usuario_id = 2)
INSERT INTO clientes (usuario_id, direccion, ciudad_id, codigo_postal) VALUES
  (2, 'Calle Gran Vía 10', 1, '28013');

-- Tienda: Carlos (usuario_id = 3) — APROBADA
INSERT INTO tiendas (id, usuario_id, nombre_negocio, nif_cif, direccion, ciudad_id, codigo_postal, descripcion, telefono_contacto, estado_revision, acepta_politica, fecha_creacion) VALUES
  (1, 3, 'Sabores de Venezuela', 'B12345678', 'Calle Mayor 25', 1, '28013',
   'Productos venezolanos y latinos auténticos traídos directamente a España.',
   '600333444', 'APROBADA', 1, '2026-03-22 14:48:48');

-- Categorías (IDs fijos para mantener coherencia con productos)
INSERT INTO categorias (id, nombre, descripcion, activa) VALUES
  (1, 'Bebidas',             'Bebidas típicas latinas',           1),
  (2, 'Dulces',              'Dulces y golosinas',                1),
  (3, 'Snacks',              'Aperitivos y pasabocas',            1),
  (4, 'Harinas',             'Harinas y derivados',               1),
  (5, 'Productos frescos',   'Productos frescos y refrigerados',  1),
  (6, 'Licores',             'Bebidas alcohólicas',               1),
  (7, 'Salsas y condimentos','Salsas, aderezos y condimentos',    1),
  (8, 'Enlatados',           'Conservas y productos enlatados',   1),
  (9, 'Congelados',          'Productos congelados y refrigerados',1);

-- Productos de la tienda "Sabores de Venezuela"
-- Los IDs 1 y 3 coinciden con el pedido de ejemplo existente
INSERT INTO productos (id, tienda_id, categoria_id, nombre, marca, pais_origen, descripcion, precio, stock, activo, destacado) VALUES
  (1, 1, 4, 'Harina PAN 1Kg',          'Harina PAN',   'Venezuela', 'Harina de maíz precocida, ideal para arepas.',             3.80, 50,  1, 1),
  (2, 1, 1, 'Maltín Polar 330ml',       'Polar',        'Venezuela', 'Bebida de malta venezolana sin alcohol.',                  1.50, 100, 1, 1),
  (3, 1, 2, 'Arequipe 250g',            'Colanta',      'Colombia',  'Dulce de leche colombiano artesanal.',                    4.20, 30,  1, 0),
  (4, 1, 7, 'Salsa Picante Valentina',  'Valentina',    'México',    'Salsa picante con sabor único mexicano.',                  2.50, 80,  1, 0),
  (5, 1, 3, 'Chicharrones 100g',        'La Preferida', 'Colombia',  'Snack crujiente de cerdo, estilo colombiano.',             3.00, 40,  1, 1),
  (6, 1, 4, 'Harina de Trigo Blanca Flor 1Kg', 'Blanca Flor', 'Perú', 'Harina de trigo suave para repostería.',                2.90, 60,  1, 0),
  (7, 1, 1, 'Café Aguila Roja 250g',    'Aguila Roja',  'Colombia',  'Café molido colombiano de tueste medio.',                  4.50, 45,  1, 1),
  (8, 1, 5, 'Queso Blanco 300g',        'La Vaquita',   'Venezuela', 'Queso blanco venezolano para arepas.',                    5.20, 20,  1, 0),
  (9, 1, 2, 'Bocadillo de Guayaba 200g','Ramo',         'Colombia',  'Dulce de guayaba colombiano en barra.',                   3.10, 35,  1, 0),
 (10, 1, 6, 'Ron Santa Teresa 700ml',   'Santa Teresa', 'Venezuela', 'Ron venezolano añejo de alta calidad.',                  18.90, 15,  1, 1);

-- Pedido de ejemplo (usa cliente_id=1 → clientes.id=1 que es María)
INSERT INTO pedidos (id, cliente_id, tienda_id, numero_pedido, estado, direccion_envio, ciudad_envio, codigo_postal_envio, subtotal, costo_envio, iva, total, fecha_pedido) VALUES
  (1, 1, 1, 'PED-0001', 'ENTREGADO', 'Calle Gran Vía 10', 'Madrid', '28013', 8.00, 2.50, 1.68, 12.18, '2026-03-22 15:00:00');

INSERT INTO detalle_pedidos (id, pedido_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal) VALUES
  (1, 1, 1, 'Harina PAN 1Kg',  3.80, 1, 3.80),
  (2, 1, 3, 'Arequipe 250g',   4.20, 1, 4.20);

INSERT INTO pedido_estados_historial (pedido_id, estado, comentario, fecha) VALUES
  (1, 'PENDIENTE',  'Pedido creado correctamente',   '2026-03-22 15:00:00'),
  (1, 'CONFIRMADO', 'Pedido confirmado por la tienda','2026-03-22 15:30:00'),
  (1, 'ENTREGADO',  'Pedido entregado al cliente',   '2026-03-23 10:00:00');

INSERT INTO pagos (pedido_id, metodo_pago, estado_pago, monto, moneda, referencia_externa, proveedor_pago) VALUES
  (1, 'TARJETA', 'PAGADO', 12.18, 'EUR', 'TXN-1001', 'Stripe');
