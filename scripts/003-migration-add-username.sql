/* ===========================
   DRIZATX – Migración username + ENUM
   Ejecutar en MySQL Workbench
   =========================== */

-- 0) Usar el schema
USE drizatx;

-- 1) Agregar columna username si NO existe (vía INFORMATION_SCHEMA para compatibilidad)
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'operators'
    AND COLUMN_NAME  = 'username'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE operators ADD COLUMN username VARCHAR(50) NULL AFTER name;',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Completar username derivado donde esté NULL o vacío
--    - Si hay email: parte previa al @
--    - Sino, derivado del nombre (lowercase con guión bajo)
--    - Sino, fallback user_<id>
UPDATE operators
SET username = CASE
  WHEN (username IS NULL OR username = '')
    THEN CASE
      WHEN email IS NOT NULL AND email <> '' THEN SUBSTRING_INDEX(email, '@', 1)
      WHEN name  IS NOT NULL AND name  <> '' THEN LOWER(REPLACE(name, ' ', '_'))
      ELSE CONCAT('user_', id)
    END
  ELSE TRIM(username)
END;

-- 3) Resolver duplicados (si los hubiera) agregando sufijo _<id>
DROP TEMPORARY TABLE IF EXISTS tmp_dups;
CREATE TEMPORARY TABLE tmp_dups AS
SELECT username
FROM operators
GROUP BY username
HAVING COUNT(*) > 1;

UPDATE operators o
JOIN tmp_dups d ON o.username = d.username
SET o.username = CONCAT(o.username, '_', o.id);

DROP TEMPORARY TABLE IF EXISTS tmp_dups;

-- 4) Volver NOT NULL
ALTER TABLE operators
  MODIFY COLUMN username VARCHAR(50) NOT NULL;

-- 5) Crear índice único si NO existe
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'operators'
    AND INDEX_NAME   = 'uq_operators_username'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE UNIQUE INDEX uq_operators_username ON operators (username);',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6) Alinear ENUM de tickets.status para incluir ABSENT (idempotente)
ALTER TABLE tickets
  MODIFY COLUMN status
    ENUM('WAITING','CALLED','IN_PROGRESS','COMPLETED','CANCELLED','ABSENT')
    NOT NULL DEFAULT 'WAITING';

-- 7) Verificación rápida (opcionales: podés ejecutar y ver resultados)
-- SELECT * FROM INFORMATION_SCHEMA.COLUMNS
--  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='operators' AND COLUMN_NAME='username';
-- SHOW INDEX FROM operators WHERE Key_name = 'uq_operators_username';
-- SELECT username, COUNT(*) c FROM operators GROUP BY username HAVING c > 1;
