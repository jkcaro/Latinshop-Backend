-- Migración: agregar columna precio_oferta a productos
ALTER TABLE productos
  ADD COLUMN precio_oferta DECIMAL(10,2) DEFAULT NULL
  AFTER precio;
