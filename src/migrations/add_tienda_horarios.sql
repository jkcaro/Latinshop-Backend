CREATE TABLE IF NOT EXISTS tienda_horarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tienda_id     INT NOT NULL,
  dia_semana    TINYINT NOT NULL COMMENT '0=Lunes 1=Martes 2=Miercoles 3=Jueves 4=Viernes 5=Sabado 6=Domingo',
  hora_apertura TIME DEFAULT NULL,
  hora_cierre   TIME DEFAULT NULL,
  cerrado       TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_tienda_dia (tienda_id, dia_semana),
  FOREIGN KEY (tienda_id) REFERENCES tiendas(id) ON DELETE CASCADE
);
