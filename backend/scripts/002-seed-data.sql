-- 002-seed-data.sql
-- Semilla de datos actualizada para el esquema vigente.
-- Ejecutar luego de aplicar las migraciones de TypeORM.

-- Servicios base
INSERT INTO services (name, prefix, priority_level, estimated_time, max_attention_time, next_ticket_number, system_locked, active)
VALUES
  ('Atención General', 'AG', 3, 15, NULL, 1, 0, 1),
  ('Consultas Médicas', 'MD', 4, 30, 45, 1, 0, 1),
  ('Trámites Administrativos', 'TR', 2, 20, NULL, 1, 0, 1),
  ('Atención VIP', 'VIP', 6, 10, 20, 1, 0, 1),
  ('Soporte Técnico', 'ST', 3, 25, 40, 1, 0, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  priority_level = VALUES(priority_level),
  estimated_time = VALUES(estimated_time),
  max_attention_time = VALUES(max_attention_time),
  active = VALUES(active),
  system_locked = VALUES(system_locked);

-- Ajustar contadores de servicios para numeración diaria
INSERT INTO service_counters (service_id, last_seq)
SELECT s.id,
       COALESCE(MAX(CAST(REGEXP_REPLACE(t.number, '[^0-9]', '') AS UNSIGNED)), 0)
FROM services s
LEFT JOIN tickets t ON t.service_id = s.id
GROUP BY s.id
ON DUPLICATE KEY UPDATE last_seq = VALUES(last_seq);

-- Operadores (usuarios del sistema)
-- Hash generado con bcrypt (10 rondas) para la contraseña "driza123"
-- $2b$10$A//8Ikg5M.DwRM0YUqatHedZRfoNadxk3z99PtOFg/jQgjadpvpIi
INSERT INTO operators (name, username, email, password_hash, position, active)
VALUES
  ('Super Administrador', 'superadmin', 'superadmin@drizatx.com', '$2b$10$A//8Ikg5M.DwRM0YUqatHedZRfoNadxk3z99PtOFg/jQgjadpvpIi', 'SuperAdmin', 1),
  ('María García', 'mgarcia', 'maria@empresa.com', '$2b$10$A//8Ikg5M.DwRM0YUqatHedZRfoNadxk3z99PtOFg/jQgjadpvpIi', 'Supervisor', 1),
  ('Juan Pérez', 'jperez', 'juan@empresa.com', '$2b$10$A//8Ikg5M.DwRM0YUqatHedZRfoNadxk3z99PtOFg/jQgjadpvpIi', 'Operador Senior', 1),
  ('Ana López', 'alopez', 'ana@empresa.com', '$2b$10$A//8Ikg5M.DwRM0YUqatHedZRfoNadxk3z99PtOFg/jQgjadpvpIi', 'Operador', 1),
  ('Carlos Rodríguez', 'crodriguez', 'carlos@empresa.com', '$2b$10$A//8Ikg5M.DwRM0YUqatHedZRfoNadxk3z99PtOFg/jQgjadpvpIi', 'Administrador', 1),
  ('Laura Martínez', 'lmartinez', 'laura@empresa.com', '$2b$10$A//8Ikg5M.DwRM0YUqatHedZRfoNadxk3z99PtOFg/jQgjadpvpIi', 'Operador', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  position = VALUES(position),
  active = VALUES(active),
  password_hash = VALUES(password_hash);

-- Asociar roles actuales (requiere que las migraciones hayan creado la tabla roles)
INSERT INTO operator_roles (operator_id, role_id)
SELECT o.id, r.id FROM operators o CROSS JOIN roles r
WHERE o.username = 'superadmin' AND r.slug = 'SUPERADMIN'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

INSERT INTO operator_roles (operator_id, role_id)
SELECT o.id, r.id FROM operators o CROSS JOIN roles r
WHERE o.username = 'crodriguez' AND r.slug = 'ADMIN'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

INSERT INTO operator_roles (operator_id, role_id)
SELECT o.id, r.id FROM operators o CROSS JOIN roles r
WHERE o.username = 'mgarcia' AND r.slug = 'SUPERVISOR'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

INSERT INTO operator_roles (operator_id, role_id)
SELECT o.id, r.id FROM operators o CROSS JOIN roles r
WHERE o.username IN ('jperez', 'alopez', 'lmartinez') AND r.slug = 'OPERATOR'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

-- Vincular operadores a servicios con peso por defecto
INSERT INTO operator_services (operator_id, service_id, weight)
SELECT o.id, s.id, 1
FROM operators o
JOIN services s ON s.prefix IN ('AG', 'TR', 'ST')
WHERE o.username IN ('superadmin', 'mgarcia', 'jperez', 'alopez', 'lmartinez')
ON DUPLICATE KEY UPDATE weight = VALUES(weight);

INSERT INTO operator_services (operator_id, service_id, weight)
SELECT o.id, s.id, 1
FROM operators o
JOIN services s ON s.prefix IN ('VIP', 'MD')
WHERE o.username IN ('superadmin', 'crodriguez')
ON DUPLICATE KEY UPDATE weight = VALUES(weight);

-- Clientes de ejemplo
INSERT INTO clients (dni, name, email, phone, vip)
VALUES
  ('12345678', 'Roberto Silva', 'roberto@email.com', '+5491123456789', FALSE),
  ('87654321', 'Carmen Vega', 'carmen@email.com', '+5491987654321', TRUE),
  ('11223344', 'Diego Morales', 'diego@email.com', '+5491122334455', FALSE),
  ('44332211', 'Sofía Herrera', 'sofia@email.com', '+5491144332211', TRUE),
  ('55667788', 'Miguel Torres', 'miguel@email.com', '+5491155667788', FALSE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  email = VALUES(email),
  phone = VALUES(phone),
  vip = VALUES(vip);

-- Configuraciones por defecto alineadas al sistema actual
INSERT INTO system_settings (`key`, value, description) VALUES
  ('maxWaitTime', '15', 'Tiempo máximo de espera en minutos'),
  ('autoCallNext', 'false', 'Llamado automático del siguiente turno'),
  ('soundEnabled', 'true', 'Sonido habilitado para llamados'),
  ('displayTimeout', '30', 'Tiempo de rotación de pantallas en segundos'),
  ('mobileEnabled', 'true', 'App móvil habilitada'),
  ('qrEnabled', 'true', 'Códigos QR habilitados'),
  ('notificationsEnabled', 'true', 'Notificaciones habilitadas'),
  ('showWaitTimes', 'true', 'Mostrar tiempos estimados de espera'),
  ('kioskRequireDni', 'false', 'Solicitar DNI obligatorio en terminales'),
  ('kioskAllowSms', 'true', 'Permitir registro de celular para SMS'),
  ('kioskShowQueueStats', 'true', 'Mostrar métricas en la terminal'),
  ('kioskWelcomeMessage', 'Bienvenido a DrizaTX. Sacá tu turno en segundos', 'Mensaje principal en la terminal'),
  ('kioskLocationName', 'Sucursal Central', 'Nombre de la sede impreso en los tickets'),
  ('signageTheme', 'corporate', 'Tema visual por defecto para cartelería'),
  ('signageShowNews', 'false', 'Mostrar carrusel de noticias'),
  ('signageShowWeather', 'true', 'Mostrar pronóstico del clima'),
  ('signageShowWaitingList', 'true', 'Mostrar lista de espera de tickets en cartelería'),
  ('signageShowFlowSummary', 'true', 'Mostrar resumen de flujo en cartelería'),
  ('signageShowKeyIndicators', 'true', 'Mostrar indicadores clave en cartelería'),
  ('signageCurrencySource', 'oficial', 'Fuente de cotizaciones para cartelería'),
  ('signageIndicatorsRefreshMinutes', '5', 'Minutos entre actualizaciones de indicadores y cotizaciones'),
  ('alertsEscalationMinutes', '15', 'Minutos para escalar alertas'),
  ('analyticsEmail', 'reportes@drizatx.com', 'Casilla que recibe reportes automáticos'),
  ('webhookUrl', '', 'Webhook para integraciones externas'),
  ('brandDisplayName', 'DrizaTx', 'Nombre visible en pantallas y apps'),
  ('brandPrimaryColor', '#0f172a', 'Color primario institucional'),
  ('brandSecondaryColor', '#22d3ee', 'Color secundario institucional'),
  ('brandLogoUrl', '', 'URL del logotipo'),
  ('displayTitle', 'DrizaTx', 'Título principal en cartelería'),
  ('displaySlogan', 'Sistema de Gestión de Colas DrizaTx', 'Slogan mostrado en pantallas'),
  ('signageWeatherLocation', 'Buenos Aires, AR', 'Ubicación para el widget de clima'),
  ('signageWeatherLatitude', '-34.6037', 'Latitud para obtener el clima'),
  ('signageWeatherLongitude', '-58.3816', 'Longitud para obtener el clima'),
  ('backup.enabled', 'true', 'Habilitar respaldos automáticos diarios'),
  ('backup.directory', 'storage/backups', 'Directorio donde se guardan los respaldos'),
  ('backup.mysqldumpPath', '', 'Ruta del ejecutable mysqldump para generar respaldos automáticos'),
  ('backup.time', '02:00', 'Horario diario para el respaldo automático'),
  ('backup.lastGeneratedAt', '', 'Fecha del último respaldo generado'),
  ('backup.lastAutomaticAt', '', 'Fecha del último respaldo automático'),
  ('backup.lastManualAt', '', 'Fecha del último respaldo manual'),
  ('backup.lastGeneratedFile', '', 'Nombre del último archivo de respaldo'),
  ('backup.lastDirectory', '', 'Directorio del último respaldo'),
  ('backup.lastSize', '0', 'Tamaño del último respaldo en bytes'),
  ('backup.lastError', '', 'Último error registrado en respaldos'),
  ('backup.lastFailureAt', '', 'Fecha del último error en respaldos'),
  ('queue.alternate_priority_every', '3', 'Cantidad de atenciones consecutivas antes de priorizar al ticket más urgente (1-6).'),
  ('terminal.printWebhookUrl', '', 'URL del webhook que recibe las solicitudes de impresión de tickets'),
  ('terminal.printWebhookToken', '', 'Token Bearer para autenticar las solicitudes de impresión')
ON DUPLICATE KEY UPDATE
  value = VALUES(value),
  description = VALUES(description);

-- Tickets de ejemplo (usa la fecha actual para cumplir con issued_for_date)
INSERT INTO tickets (number, service_id, issued_for_date, status, priority_level, operator_id, client_id, mobile_phone)
VALUES
  ('AG001', (SELECT id FROM services WHERE prefix = 'AG'), CURRENT_DATE(), 'WAITING', 3, NULL, (SELECT id FROM clients WHERE dni = '12345678'), '+5491123456789'),
  ('MD001', (SELECT id FROM services WHERE prefix = 'MD'), CURRENT_DATE(), 'IN_PROGRESS', 4, (SELECT id FROM operators WHERE username = 'mgarcia'), (SELECT id FROM clients WHERE dni = '87654321'), '+5491987654321'),
  ('TR001', (SELECT id FROM services WHERE prefix = 'TR'), CURRENT_DATE(), 'COMPLETED', 2, (SELECT id FROM operators WHERE username = 'jperez'), (SELECT id FROM clients WHERE dni = '11223344'), '+5491122334455'),
  ('VIP001', (SELECT id FROM services WHERE prefix = 'VIP'), CURRENT_DATE(), 'WAITING', 6, NULL, (SELECT id FROM clients WHERE dni = '44332211'), '+5491144332211'),
  ('ST001', (SELECT id FROM services WHERE prefix = 'ST'), CURRENT_DATE(), 'CALLED', 3, (SELECT id FROM operators WHERE username = 'alopez'), (SELECT id FROM clients WHERE dni = '55667788'), '+5491155667788')
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  priority_level = VALUES(priority_level),
  operator_id = VALUES(operator_id),
  client_id = VALUES(client_id),
  mobile_phone = VALUES(mobile_phone);
