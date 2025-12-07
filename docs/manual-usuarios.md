# Manual de Usuario — Sistema Integral de Gestión de Colas (DrizaTx)

## 1. Introducción
El Sistema Integral de Gestión de Colas DrizaTx coordina la emisión de turnos, la atención presencial, la cartelería digital y los reportes operativos de una organización. Este manual explica, en lenguaje funcional, cómo utilizar cada parte de la plataforma sin necesidad de conocimientos técnicos. Está dirigido a personal de ventanilla, supervisores y administradores.

## 2. Roles y permisos
El acceso se controla mediante usuario y contraseña. Cada perfil visualiza únicamente los módulos que necesita:

| Rol | Uso principal | Módulos habilitados |
| --- | --- | --- |
| **Operador** | Gestionar turnos asignados | Inicio, Operador, Dashboard (resumen), Cartelería digital |
| **Supervisor** | Monitoreo y métricas | Inicio, Dashboard completo, Reportes, Cartelería digital |
| **Administrador** | Configuración del sistema | Todos los módulos operativos y de administración |
| **Superadministrador** | Gobierno total del sistema (incluye documentación técnica) | Todos los módulos + documentación API |
| **Público** | Autoservicio y visualización | Terminal de turnos, Cartelería, App móvil |

> 💡 **Consejo:** tras iniciar sesión, la página de inicio muestra un mensaje personalizado y accesos directos a los módulos disponibles según el rol.【F:frontend/app/page.tsx†L12-L99】

## 3. Primer ingreso
1. Accede a `https://tu-dominio/login` o a la URL local provista por TI.
2. Introduce las credenciales según tu rol (ver documento de credenciales de tu organización).
3. Cambia la contraseña inicial en cuanto el administrador lo solicite.
4. Revisa la tarjeta “Dashboard Operativo” en la página principal para confirmar que el estado de la cola se visualiza correctamente.

## 4. Módulos del sistema
Cada módulo se encuentra en la barra lateral. Los nombres pueden variar según las traducciones corporativas, pero mantienen las funciones descritas a continuación.

### 4.1 Inicio (`/`)
- Muestra un saludo con el rol activo y botones rápidos hacia los módulos disponibles.
- Permite ir al **Dashboard** o iniciar sesión si todavía no hay una sesión abierta.

### 4.2 Dashboard Operativo (`/dashboard`)
- Presenta tarjetas con el estado de las colas, tiempos promedio y próximos turnos.
- Filtra la información por servicio o ver la visión general.
- Desde la sección “Colas” puedes abrir el detalle de cada servicio y exportar la lista como CSV o JSON.【F:frontend/app/(app)/dashboard/queues/page.tsx†L86-L179】【F:frontend/app/(app)/dashboard/page.tsx†L54-L472】

### 4.3 Panel de Operador (`/operator`)
- Selecciona el servicio asignado y muestra los tickets en espera, llamados y en atención.
- Botones principales: **Llamar/confirmar**, **Empezar atención**, **Finalizar**, **Marcar ausente**. Cada acción actualiza el estado del ticket y las métricas en tiempo real.【F:frontend/app/(app)/operator/page.tsx†L1-L136】
- Atajos de teclado (1, 2, 3, etc.) aceleran las acciones para puestos con alto volumen de atención.
- Indicadores de disponibilidad permiten pasar a “Descanso” o “Activo” según corresponda.

### 4.4 Terminal de Autoservicio (`/terminal`)
- Dirigida al público para generar un ticket.
- Flujo: validar DNI → elegir servicio → confirmar datos → recibir ticket con número, tiempo estimado y QR simulado.【F:frontend/app/(app)/docs/page.tsx†L116-L169】
- Puede instalarse en kioscos táctiles o pantallas dedicadas.

### 4.5 Cartelería Digital (`/display`)
- Visualiza el turno llamado, los puestos en atención y la lista de espera para proyectores o televisores en la sala.【F:frontend/app/(app)/docs/page.tsx†L36-L44】
- Incluye estadísticas básicas como cantidad de tickets atendidos y tiempos promedio.

### 4.6 App Móvil (`/mobile`)
- Permite que el ciudadano consulte su turno desde el teléfono y reciba actualizaciones del estado de la cola.【F:frontend/app/(app)/docs/page.tsx†L39-L44】
- Ideal para reducir la permanencia física en la sala de espera.

### 4.7 Reportes y Analytics (`/reports`)
- Panel con indicadores diarios y semanales, tiempos de servicio y comparativas por operador/servicio.
- Exporta datos históricos para análisis externo o respaldo manual.【F:frontend/app/(app)/docs/page.tsx†L45-L47】

### 4.8 Gestión de Clientes (`/clients`)
- Búsqueda por DNI, alta manual y edición de registros existentes.
- Importación masiva mediante archivos CSV cuando se necesita precargar padrón de clientes.【F:frontend/app/(app)/docs/page.tsx†L48-L51】

### 4.9 Administración (`/admin`)
- Configuración de servicios, operadores, mensajes personalizados y horarios.
- Sección de respaldos para verificar copias de seguridad automáticas y lanzar un backup manual cuando el sistema está conectado al backend real.【F:frontend/app/(app)/admin/page.tsx†L232-L2838】
- Desde aquí también se gestionan los ajustes globales (por ejemplo, llamada automática del siguiente turno).
- La subsección **Terminal de autoservicio** permite cargar la URL y el token del servicio "puente" que imprime tickets en la oficina. Encontrás el paso a paso en `docs/terminal-printing.md`.

## 5. Flujos de trabajo recomendados

### 5.1 Emisión de turnos
1. **Terminal de autoservicio:** el ciudadano sigue los pasos guiados y recibe un ticket impreso o digital.
2. **App móvil:** personal de recepción puede enviar un enlace directo para que el ciudadano genere el turno desde su teléfono.
3. **Carga manual (operador):** si es necesario registrar a alguien sin documentación, el operador puede crear un ticket y asociarlo a un cliente desde su panel.

### 5.2 Atención al ciudadano
1. El operador ingresa a `/operator` y selecciona su servicio.
2. Presiona **Llamar** para notificar al siguiente ticket. El número aparece automáticamente en la cartelería digital.
3. Inicia la atención con **Empezar atención** y finaliza con **Finalizar** o **Marcar ausente**.
4. Si necesita pausar, cambia su disponibilidad a “Descanso” para que el supervisor vea el estado real del puesto.

### 5.3 Supervisión en tiempo real
1. El supervisor abre el **Dashboard** y selecciona los servicios de interés.
2. Revisa los indicadores (promedio de espera, tickets en cola, nivel de servicio) para tomar decisiones inmediatas.【F:frontend/app/(app)/dashboard/page.tsx†L442-L472】
3. Puede proyectar la cartelería digital en la sala para informar a los ciudadanos.

### 5.4 Análisis histórico
1. Ingresar a **Reportes** para ver tendencias por día y semana.
2. Exportar los resultados en JSON o CSV desde la vista de colas o reportes para compartir con la gerencia.【F:frontend/app/(app)/dashboard/queues/page.tsx†L86-L179】

### 5.5 Administración de catálogo y ajustes
1. Entra a **Administración** para editar servicios (nombre, prefijo, tiempos estimados), operadores y mensajes.
2. Verifica los respaldos automáticos; si se utiliza el backend real, asegúrate de que aparezca la fecha del último backup.
3. Ajusta parámetros globales como llamada automática o límites de tickets.

## 6. Buenas prácticas operativas
- Mantén actualizada la disponibilidad de cada operador para que las métricas reflejen la realidad.
- Revisa diariamente el reporte de tiempos de espera para detectar desvíos.
- Programa pruebas periódicas de la terminal autoservicio y la cartelería antes de abrir al público.
- Documenta incidencias y comunícalas al supervisor o administrador con los detalles del ticket afectado.

## 7. Soporte y escalamiento
- Ante fallas operativas, contacta primero al administrador local.
- Si el problema involucra integraciones externas o la API, el superadministrador debe consultar la documentación técnica descrita en `docs/superadmin-api.md`.
- Cualquier cambio de roles o altas de usuarios debe ser solicitado formalmente para mantener la trazabilidad.

---
**Importante:** la información técnica (API, despliegue, integraciones) es exclusiva para el superadministrador y no forma parte de este manual operativo.
