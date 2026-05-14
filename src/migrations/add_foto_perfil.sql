-- Migración: agregar columna foto_perfil a usuarios
ALTER TABLE usuarios
  ADD COLUMN foto_perfil MEDIUMTEXT DEFAULT NULL;
