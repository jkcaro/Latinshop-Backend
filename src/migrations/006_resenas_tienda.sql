CREATE TABLE IF NOT EXISTS resenas_tienda (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  tienda_id    INT NOT NULL,
  cliente_id   INT NOT NULL,
  pedido_id    INT NOT NULL,
  calificacion TINYINT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  comentario   TEXT DEFAULT NULL,
  estado       ENUM('VISIBLE', 'OCULTA') NOT NULL DEFAULT 'VISIBLE',
  fecha        DATETIME NOT NULL DEFAULT NOW(),

  UNIQUE KEY uq_resena_pedido (pedido_id),

  FOREIGN KEY (tienda_id)  REFERENCES tiendas(id)  ON DELETE CASCADE,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  FOREIGN KEY (pedido_id)  REFERENCES pedidos(id)  ON DELETE CASCADE
);
