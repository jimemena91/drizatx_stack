# Control de Tiempo Máximo de Atención

## 1. Descripción funcional (para usuarios y supervisores)
El sistema permite definir un tiempo máximo de atención por servicio u operador. Al iniciar la atención de un turno, comienza a contar un cronómetro que se detiene cuando el ticket se cierra. Si la atención supera el tiempo configurado, se dispara una alarma sonora y se muestra un aviso visual en el dashboard. El tiempo real empleado queda registrado en el historial del operador para su consulta posterior en reportes y métricas.

## 2. Flujos de usuario (para UI/UX)
### Configuración
En el módulo de administración, el supervisor establece el "Tiempo Máximo de Atención" por servicio u operador.

### Inicio de atención
Cuando el operador llama un turno, el sistema inicia automáticamente un cronómetro interno asociado al ticket.

### Alarma
Si el tiempo supera el límite configurado, el sistema activa:
- Una alarma sonora (beep o alerta configurable).
- Una notificación visual en el dashboard y en la cartelería de supervisores.

### Registro
El tiempo real de atención queda guardado junto al ticket, asociado al operador correspondiente.

### Consulta
En la vista de cada operador, el supervisor puede revisar:
- Tiempo promedio de atención.
- Cantidad de veces que superó el tiempo configurado.
- Detalle por ticket con la duración real.

## 3. Tareas técnicas (para desarrolladores)
### Backend (NestJS + MySQL)
1. Agregar un campo `max_attention_time` (en minutos) en la tabla `services` o `operator_services`.
2. Modificar la entidad `Ticket` para almacenar `attention_duration` (tiempo real de atención).
3. Al cerrar un ticket, calcular `end_time - start_time` y guardar el resultado en la base de datos.
4. Crear un endpoint para obtener alertas de tickets que superaron el tiempo máximo configurado.

### Frontend (Next.js + React)
1. En la vista de administración, permitir configurar el tiempo máximo por servicio u operador.
2. En la vista del operador, iniciar un cronómetro al abrir un ticket.
3. Al exceder el tiempo máximo:
   - Generar un beep usando la Web Audio API (sin depender de archivos binarios).
   - Mostrar un modal o un toast de alerta.
4. En el dashboard de supervisión, resaltar a los operadores que están excediendo el tiempo.
5. En la ficha del operador, mostrar:
   - Promedio de atención.
   - Tickets fuera de tiempo.
   - Historial con la duración real de cada ticket.
