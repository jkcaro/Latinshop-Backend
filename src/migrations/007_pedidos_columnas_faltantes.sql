ALTER TABLE pedidos
  ADD COLUMN acepta_condiciones_compra TINYINT(1) NOT NULL DEFAULT 0 AFTER observaciones,
  ADD COLUMN metodo_envio ENUM('ESTANDAR','EXPRESS','RECOGIDA_TIENDA') NOT NULL DEFAULT 'ESTANDAR' AFTER acepta_condiciones_compra;
