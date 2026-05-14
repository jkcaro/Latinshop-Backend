-- =====================================================
--  Migración 005 — Tokens de recuperación de contraseña
-- =====================================================

USE latinshop_espana;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL,
  token       VARCHAR(64) NOT NULL UNIQUE,
  expira_en   DATETIME NOT NULL,
  usado       TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion DATETIME DEFAULT NOW(),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_usuario (usuario_id)
);
