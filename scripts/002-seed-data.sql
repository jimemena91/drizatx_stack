USE drizatx;

-- Servicios iniciales
INSERT IGNORE INTO services (name, prefix, active, priority, estimated_time) VALUES
('Atención General', 'A', TRUE, 1, 8),
('Caja',             'B', TRUE, 2, 5),
('Consultas',        'C', TRUE, 3, 15),
('Reclamos',         'R', TRUE, 4, 12);

-- Operadores iniciales (con username). Contraseña ejemplo: "123456" (hash de demo).
-- Cambiá el hash si vas a usar auth real; para dev podés usar AUTH_DEV_BYPASS=true en backend.
INSERT IGNORE INTO operators (name, username, email, password_hash, position, role, active) VALUES
('Juan Pérez',     'juan',      'juan@drizatx.com',  '$2b$10$rQZ8kHWfE7P7VtKXvZ1zUeJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9', 'Puesto 1', 'OPERATOR',   TRUE),
('María García',   'maria',     'maria@drizatx.com', '$2b$10$rQZ8kHWfE7P7VtKXvZ1zUeJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9', 'Puesto 2', 'OPERATOR',   TRUE),
('Carlos López',   'carlos',    'carlos@drizatx.com','$2b$10$rQZ8kHWfE7P7VtKXvZ1zUeJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9', 'Puesto 3', 'SUPERVISOR', TRUE),
('Ana Martín',     'ana',       'ana@drizatx.com',   '$2b$10$rQZ8kHWfE7P7VtKXvZ1zUeJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9', 'Puesto 4', 'OPERATOR',   TRUE),
('Admin Sistema',  'admin',     'admin@drizatx.com', '$2b$10$rQZ8kHWfE7P7VtKXvZ1zUeJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9', 'Administración', 'ADMIN', TRUE);

-- Configuraciones del sistema
INSERT IGNORE INTO system_settings (`key`, value, description) VALUES
('max_wait_time',          '15',  'Tiempo máximo de espera en minutos'),
('auto_call_next',         'true','Llamado automático del siguiente turno'),
('sound_enabled',          'true','Sonido habilitado para llamados'),
('display_timeout',        '30',  'Tiempo de rotación de pantallas en segundos'),
('mobile_enabled',         'true','App móvil habilitada'),
('qr_enabled',             'true','Códigos QR habilitados'),
('notifications_enabled',  'true','Notificaciones habilitadas'),
('service_level_target',   '90',  'Meta de nivel de servicio en porcentaje');

-- Algunos turnos de ejemplo (status usa mayúsculas + ABSENT soportado por esquema)
INSERT IGNORE INTO tickets (number, service_id, status, created_at) VALUES
('A001', 1, 'COMPLETED',    CURRENT_TIMESTAMP - INTERVAL 2 HOUR),
('A002', 1, 'COMPLETED',    CURRENT_TIMESTAMP - INTERVAL 1 HOUR - INTERVAL 45 MINUTE),
('A003', 1, 'IN_PROGRESS',  CURRENT_TIMESTAMP - INTERVAL 5 MINUTE),
('B001', 2, 'WAITING',      CURRENT_TIMESTAMP - INTERVAL 3 MINUTE),
('B002', 2, 'WAITING',      CURRENT_TIMESTAMP - INTERVAL 2 MINUTE),
('C001', 3, 'WAITING',      CURRENT_TIMESTAMP - INTERVAL 8 MINUTE);
