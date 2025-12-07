-- DrizaTx - Estructura MySQL unificada
CREATE DATABASE IF NOT EXISTS drizatx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE drizatx;

-- Servicios
CREATE TABLE IF NOT EXISTS services (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  prefix VARCHAR(10) NOT NULL,
  next_ticket_number INT UNSIGNED NOT NULL DEFAULT 1,
  active TINYINT(1) DEFAULT 1,
  priority INT DEFAULT 1,
  estimated_time INT DEFAULT 10, -- minutos
  max_attention_time INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_services_prefix (prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Operadores (con username único + email opcional único)
CREATE TABLE IF NOT EXISTS operators (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NULL,
  password_hash VARCHAR(255) NULL,
  position VARCHAR(100),
  role ENUM('OPERATOR','SUPERVISOR','ADMIN') DEFAULT 'OPERATOR',
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_operators_username (username),
  UNIQUE KEY uq_operators_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Clientes
CREATE TABLE IF NOT EXISTS clients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dni VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  vip TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clients_dni (dni)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tickets  (status incluye ABSENT para alinear con el front)
CREATE TABLE IF NOT EXISTS tickets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(20) NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  status ENUM('WAITING','CALLED','IN_PROGRESS','COMPLETED','CANCELLED','ABSENT') DEFAULT 'WAITING',
  priority INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  called_at TIMESTAMP NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  operator_id INT UNSIGNED NULL,
  estimated_wait_time INT NULL,
  actual_wait_time INT NULL,
  mobile_phone VARCHAR(20) NULL,
  notification_sent TINYINT(1) DEFAULT 0,
  client_id INT UNSIGNED NULL,
  CONSTRAINT fk_tickets_service  FOREIGN KEY (service_id)  REFERENCES services(id)  ON DELETE CASCADE,
  CONSTRAINT fk_tickets_operator FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL,
  CONSTRAINT fk_tickets_client   FOREIGN KEY (client_id)   REFERENCES clients(id)   ON DELETE SET NULL,
  KEY idx_tickets_service_status (service_id, status),
  KEY idx_tickets_created_at (created_at),
  KEY idx_tickets_operator_id (operator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Configuración del sistema
CREATE TABLE IF NOT EXISTS system_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL,  -- `key` escapado por ser palabra reservada
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_system_settings_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- (Opcional) Sesiones de atención
CREATE TABLE IF NOT EXISTS attention_sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  operator_id INT UNSIGNED,
  tickets_attended INT DEFAULT 0,
  total_time_minutes INT DEFAULT 0,
  average_time_minutes DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_operator FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL,
  KEY idx_sessions_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- (Opcional) Métricas diarias
CREATE TABLE IF NOT EXISTS daily_metrics (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  total_tickets INT DEFAULT 0,
  completed_tickets INT DEFAULT 0,
  cancelled_tickets INT DEFAULT 0,
  average_wait_time DECIMAL(5,2) DEFAULT 0,
  peak_hour INT,
  service_level_percentage DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_daily_metrics_date (date),
  KEY idx_daily_metrics_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
