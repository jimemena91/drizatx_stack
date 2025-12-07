-- Insertar servicios iniciales
INSERT INTO services (name, prefix, active, priority, estimated_time) VALUES
('Atención General', 'A', true, 1, 8),
('Caja', 'B', true, 2, 5),
('Consultas', 'C', true, 3, 15),
('Reclamos', 'R', true, 4, 12)
ON CONFLICT (prefix) DO NOTHING;

-- Insertar operadores iniciales (contraseña: "123456")
INSERT INTO operators (name, email, password_hash, position, role, active) VALUES
('Juan Pérez', 'juan@drizatx.com', '$2b$10$rQZ8kHWfE7P7VtKXvZ1zUeJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9', 'Puesto 1', 'operator', true),
('María García', 'maria@drizatx.com', '$2b$10$rQZ8kHWfE7P7VtKXvZ1zUeJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9', 'Puesto 2', 'operator', true),
('Carlos López', 'carlos@drizatx.com', '$2b$10$rQZ8kHWfE7P7VtKXvZ1zUeJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9', 'Puesto 3', 'supervisor', true),
('Ana Martín', 'ana@drizatx.com', '$2b$10$rQZ8kHWfE7P7VtKXvZ1zUeJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9', 'Puesto 4', 'operator', true),
('Admin Sistema', 'admin@drizatx.com', '$2b$10$rQZ8kHWfE7P7VtKXvZ1zUeJ4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9', 'Administración', 'admin', true)
ON CONFLICT (email) DO NOTHING;

-- Insertar configuraciones iniciales del sistema
INSERT INTO system_settings (key, value, description) VALUES
('max_wait_time', '15', 'Tiempo máximo de espera en minutos'),
('auto_call_next', 'true', 'Llamado automático del siguiente turno'),
('sound_enabled', 'true', 'Sonido habilitado para llamados'),
('display_timeout', '30', 'Tiempo de rotación de pantallas en segundos'),
('mobile_enabled', 'true', 'App móvil habilitada'),
('qr_enabled', 'true', 'Códigos QR habilitados'),
('notifications_enabled', 'true', 'Notificaciones habilitadas'),
('service_level_target', '90', 'Meta de nivel de servicio en porcentaje')
ON CONFLICT (key) DO NOTHING;

-- Insertar algunos turnos de ejemplo para testing
INSERT INTO tickets (number, service_id, status, created_at) VALUES
('A001', 1, 'completed', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
('A002', 1, 'completed', CURRENT_TIMESTAMP - INTERVAL '1 hour 45 minutes'),
('A003', 1, 'in_progress', CURRENT_TIMESTAMP - INTERVAL '5 minutes'),
('B001', 2, 'waiting', CURRENT_TIMESTAMP - INTERVAL '3 minutes'),
('B002', 2, 'waiting', CURRENT_TIMESTAMP - INTERVAL '2 minutes'),
('C001', 3, 'waiting', CURRENT_TIMESTAMP - INTERVAL '8 minutes');
