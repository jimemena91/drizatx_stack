-- 010-create-database-test.sql (v2)
-- Crea la base de datos de pruebas para DrizaTx.
-- Compatible con MySQL 5.7/8.0 y MariaDB (usa utf8mb4_unicode_ci).

CREATE DATABASE IF NOT EXISTS `drizatx_test`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
