# Lógica de prioridades en la cola global

Este documento resume cómo el backend determina qué ticket esperar y cómo se respeta la prioridad especial 6.

## Normalización de prioridades

* **Servicios:** Al crear o editar un servicio, `ServicesService.sanitizePriority` garantiza que el nivel quede en el rango 1–6. Cuando se guarda un servicio, los tickets pendientes vinculados reciben el nuevo nivel mediante `updateTicketPrioritiesForService`. Esto asegura que un servicio configurado en 6 propague ese valor a los tickets en espera y a los llamados o en atención.
* **Tickets manuales:** En `TicketsService.create`, la prioridad opcional enviada por un operador también se normaliza en el rango 1–6. Si el operador no especifica una prioridad, se toma la del servicio asociado.

## Selección del siguiente ticket (`findNextTicketForGlobalQueue`)

1. **Prioridad 6 incondicional:** Antes de considerar cualquier otro criterio, se busca el ticket en estado `WAITING` con prioridad 6 más antiguo (ordenado por `requeued_at`/`created_at`). Si existe, se devuelve inmediatamente, sin alternancias ni esperas.
2. **Modo alternado configurable:** Si no hay prioridad 6, se consulta el ajuste `queue.alternate_priority_every` (por defecto 3). Cuando el ajuste es 1, la cola ordena simplemente por prioridad descendente (5 antes que 4, etc.).
3. **Ventana alternada:** Para valores mayores a 1, se construye una ventana con los primeros `alternate_priority_every` tickets en espera (excluyendo prioridad 6). Dentro de esa ventana se prioriza el ticket con la prioridad más alta disponible. Esto evita que los niveles altos queden relegados: si el ticket con mayor prioridad en toda la cola no está dentro de la ventana, se toma directamente.

Con este flujo, los tickets de prioridad 6 saltan al frente sin esperar, mientras que los de prioridad 5 mantienen ventaja sobre los niveles 4 o menores dentro de la política de alternancia configurada.
