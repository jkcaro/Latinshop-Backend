-- Ejecutar en la base de datos latinshop_espana
CREATE TABLE IF NOT EXISTS mensajes (
  id              INT          NOT NULL AUTO_INCREMENT,
  pedido_id       INT          NOT NULL,
  remitente_tipo  ENUM('CLIENTE','TIENDA') NOT NULL,
  remitente_id    INT          NOT NULL,
  contenido       TEXT         NOT NULL,
  fecha_envio     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leido           TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
  INDEX idx_mensajes_pedido (pedido_id),
  INDEX idx_mensajes_no_leidos (pedido_id, remitente_tipo, leido)
);
