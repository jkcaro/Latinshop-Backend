-- =====================================================
--  Migración 004 — Cumplimiento legal RGPD / LOPDGDD
--  Ejecutar sobre la base de datos latinshop_espana
-- =====================================================

USE latinshop_espana;

-- ---------------------------------------------------------
-- 1. Registro de consentimiento de cookies (auditoría)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS consentimientos_cookies (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id             INT          DEFAULT NULL,
  ip_hash                VARCHAR(64)  DEFAULT '',
  necesarias             TINYINT(1)   NOT NULL DEFAULT 1,
  analiticas             TINYINT(1)   NOT NULL DEFAULT 0,
  marketing              TINYINT(1)   NOT NULL DEFAULT 0,
  fecha_consentimiento   DATETIME     DEFAULT NOW(),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- 2. Aceptación de política de privacidad en clientes
-- ---------------------------------------------------------
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS acepta_privacidad        TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_acepta_privacidad  DATETIME   DEFAULT NULL;

-- ---------------------------------------------------------
-- 3. Aceptación de condiciones de compra en pedidos
-- ---------------------------------------------------------
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS acepta_condiciones_compra TINYINT(1) NOT NULL DEFAULT 0;
