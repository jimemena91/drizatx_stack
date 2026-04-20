# DrizaTx – Arquitectura de Impresión v2 basada en `print_jobs`

## 1. Objetivo

Definir la arquitectura oficial de impresión robusta de DrizaTx para entornos productivos, reemplazando el modelo anterior basado en webhook directo por un flujo desacoplado con cola persistente.

Esta arquitectura busca resolver de forma mantenible y escalable los siguientes problemas:

- pérdida de impresiones ante cortes de red o caídas temporales,
- dependencia de conectividad exacta en el momento de emisión del ticket,
- dificultad para recuperar trabajos pendientes,
- baja trazabilidad técnica del proceso de impresión,
- riesgo de inconsistencias entre generación de ticket e impresión física.

El nuevo diseño se apoya en una cola persistente de trabajos de impresión (`print_jobs`) gestionada por el backend, y en un bridge local que consume jobs mediante `claim`, imprime y reporta el resultado.

---

## 2. Problemas del modelo anterior basado en webhook

La arquitectura anterior se apoyaba en este flujo:

`Terminal -> Backend -> webhook HTTP directo -> Print Bridge -> impresora`

Ese enfoque funcionó como primera aproximación, pero presentaba limitaciones importantes para un sistema distribuido con impresión remota:

### 2.1 Dependencia de conectividad en tiempo real
Si al momento de generar el ticket el bridge no estaba disponible, la impresión fallaba en el acto.

### 2.2 Acoplamiento fuerte
El backend necesitaba conectarse exitosamente al bridge justo en el momento del evento de negocio. Eso acoplaba en exceso la operación del sistema con el estado de la red y de la PC cliente.

### 2.3 Baja recuperabilidad
Si había una caída transitoria, no existía una cola persistente nativa del sistema que permitiera recuperar de forma controlada los trabajos no impresos.

### 2.4 Riesgo operativo
Ante fallos intermitentes, los reintentos podían quedar mal resueltos o apoyarse en lógica externa, con menor trazabilidad y mayor riesgo de duplicación.

### 2.5 Observabilidad insuficiente
El modelo webhook no ofrecía por sí mismo un ciclo de vida robusto de los trabajos de impresión con estados claros, recuperación de stale jobs y diagnóstico histórico consistente.

Por estas razones, el modelo webhook directo deja de ser la arquitectura principal de DrizaTx y pasa a considerarse un enfoque legacy o de transición.

---

## 3. Nueva arquitectura propuesta

La nueva arquitectura oficial de impresión de DrizaTx se basa en una cola persistente de trabajos de impresión administrada por el backend.

### Flujo general

`Terminal -> Backend -> tabla print_jobs -> Bridge local hace claim -> imprime -> Bridge reporta resultado`

### Principios del diseño

- **Persistencia antes que entrega inmediata**  
  El ticket se registra primero como job persistente.

- **Desacople entre negocio e impresión física**  
  La operación de negocio no depende de que el bridge esté disponible exactamente en ese instante.

- **Consumo pull-based**  
  El bridge consume trabajos desde el backend; el backend no empuja directamente al bridge como mecanismo principal.

- **Recuperación explícita**  
  Los trabajos stale o fallidos pueden reencolarse o recuperarse de forma controlada.

- **Trazabilidad de estados**  
  Cada trabajo de impresión tiene un ciclo de vida observable.

---

## 4. Componentes del flujo

## 4.1 Terminal
Es el origen funcional del evento.  
Cuando el usuario genera un ticket, la terminal dispara la lógica de creación del job de impresión.

## 4.2 Backend DrizaTx
Es la fuente de verdad del proceso.

Responsabilidades principales:

- crear jobs en `print_jobs`,
- exponer endpoints para claim y actualización de estado,
- evitar inconsistencias de negocio,
- permitir recuperación de jobs stale,
- centralizar trazabilidad y auditoría.

## 4.3 Tabla `print_jobs`
Es la cola persistente del sistema.

Representa cada trabajo de impresión pendiente o procesado, con sus estados y metadatos asociados.

## 4.4 Print Bridge
Es un agente local que corre en la PC cliente donde está conectada la impresora.

Responsabilidades principales:

- pedir trabajos al backend,
- reclamar un job disponible,
- imprimir físicamente,
- informar éxito o error,
- recuperarse ante reinicios y fallos temporales.

## 4.5 Impresora térmica
Es el dispositivo físico final.  
No participa de la lógica de negocio, pero sí condiciona la implementación técnica del bridge.

---

## 5. Flujo end-to-end

## 5.1 Creación del job
1. La terminal genera un ticket.
2. El backend crea un registro en `print_jobs` con estado inicial `pending`.

## 5.2 Claim del bridge
1. El bridge consulta al backend.
2. El backend asigna un trabajo disponible mediante `/print-jobs/claim`.
3. El job pasa a estado `processing`.

## 5.3 Ejecución de la impresión
1. El bridge transforma el payload al formato imprimible.
2. Envía el contenido a la impresora real.
3. Captura el resultado técnico del intento.

## 5.4 Confirmación de resultado
- Si la impresión fue exitosa, el bridge informa `printed`.
- Si falló, informa `failed`.
- Si el trabajo quedó en estado inconsistente o vencido, puede intervenir lógica de recuperación o requeue.

## 5.5 Recuperación
Si un job queda bloqueado en `processing` por caída del bridge, reinicio de la PC o corte de red, el backend puede ejecutar `recover-stale` para devolverlo a un estado recuperable.

---

## 6. Estados de `print_jobs`

La arquitectura actual contempla los siguientes estados funcionales:

- `pending`
- `processing`
- `printed`
- `failed`

### 6.1 `pending`
El trabajo fue creado y está esperando ser reclamado por un bridge.

### 6.2 `processing`
El trabajo fue reclamado por un bridge y está en curso de procesamiento.

Este estado requiere control cuidadoso porque puede quedar stale si el bridge cae antes de informar el resultado.

### 6.3 `printed`
El trabajo fue informado como impreso correctamente.

### 6.4 `failed`
El bridge informó que no pudo completar la impresión.

---

## 7. Endpoints actuales del flujo

Actualmente el flujo validado en staging expone estos endpoints:

- `POST /print-jobs`
- `POST /print-jobs/claim`
- `POST /print-jobs/:id/printed`
- `POST /print-jobs/:id/failed`
- `POST /print-jobs/:id/requeue`
- `POST /print-jobs/recover-stale`
- `GET /print-jobs/pending`

Estos endpoints cubren:

- creación del trabajo,
- toma del trabajo por un bridge,
- cierre exitoso,
- cierre con error,
- reencolado,
- recuperación de jobs stale,
- inspección operativa de pendientes.

---

## 8. Responsabilidades del backend

El backend tiene la responsabilidad central del flujo.

### Debe garantizar:

- persistencia del job antes de intentar impresión,
- consistencia del estado global del trabajo,
- transición válida entre estados,
- capacidad de recuperación de trabajos bloqueados,
- trazabilidad suficiente para diagnóstico,
- protección frente a reclamos simultáneos o inválidos.

### El backend no debe:

- depender de la disponibilidad instantánea del bridge para completar la operación de negocio,
- reimprimir automáticamente sin control explícito,
- delegar el estado real del job únicamente al bridge.

---

## 9. Responsabilidades del bridge

El bridge es un ejecutor técnico, no la fuente de verdad.

### Debe hacer:

- consultar jobs disponibles,
- reclamar uno cuando tenga capacidad,
- imprimirlo físicamente,
- informar el resultado real al backend,
- tolerar fallos temporales de red,
- registrar diagnóstico local,
- recuperarse ante reinicios.

### No debe hacer:

- inventar estados de negocio,
- procesar un mismo job múltiples veces sin validación,
- reimprimir automáticamente un job ambiguo sin política explícita,
- convertirse en la única fuente de trazabilidad.

---

## 10. `recover-stale` y tolerancia a fallos

Uno de los puntos centrales de esta arquitectura es la capacidad de recuperación.

### Escenario típico de stale
1. El bridge hace `claim`.
2. El job pasa a `processing`.
3. Antes de informar `printed` o `failed`, ocurre una caída:
   - corte de luz,
   - reinicio del sistema,
   - caída del proceso,
   - pérdida de red.

En ese caso el job puede quedar trabado en `processing`.

### Solución
El backend expone `POST /print-jobs/recover-stale` para detectar y recuperar esos trabajos, devolviéndolos a un estado operable.

### Beneficio
Esto evita que un error transitorio bloquee indefinidamente la cola de impresión.

---

## 11. Política anti-duplicados

La arquitectura v2 prioriza evitar duplicaciones físicas de tickets.

### Regla principal
No debe reimprimirse automáticamente un trabajo si ya existe posibilidad razonable de que haya sido enviado al spooler o a la impresora.

### Principios asociados
- un reintento de red no es automáticamente un reintento de impresión física,
- una confirmación pendiente no equivale a un fallo de impresión,
- la reimpresión debe ser una acción controlada y trazable,
- los estados ambiguos deben tratarse con política explícita.

Esto es especialmente importante porque el costo operativo de un ticket duplicado puede ser mayor que el de un ticket demorado.

---

## 12. Observabilidad y auditoría

La impresión debe poder auditarse.

### Mínimos esperados en backend
- estado actual del job,
- timestamps relevantes,
- historial de cambios de estado,
- identificación del bridge que procesó el job,
- capacidad de inspección de pendientes y fallidos.

### Mínimos esperados en bridge
- logs locales estructurados,
- error técnico concreto cuando falla la impresión,
- referencia del job procesado,
- marca temporal de ejecución.

La trazabilidad no debe depender únicamente de mirar la impresora o deducir el comportamiento desde la terminal.

---

## 13. Validación actual en staging

El flujo actual ya fue validado end-to-end en la rama de trabajo `feature/print-queue-foundation`.

Validaciones confirmadas:

- creación de jobs,
- claim por parte del bridge,
- marcado de `printed`,
- marcado de `failed`,
- recuperación mediante `recover-stale`,
- corrección aplicada para liberar `lockedAt` al marcar `printed`,
- bridge simulado funcional mediante script.

Esto confirma que la base transaccional del nuevo modelo está operativa en staging y lista para evolucionar hacia un bridge real de impresión.

---

## 14. Relación con la documentación legacy

La documentación previa basada en webhook directo, túnel SSH y bridge Node simple debe conservarse como documentación histórica u operativa de transición, pero ya no representa la arquitectura principal recomendada.

Su utilidad actual pasa a ser:

- referencia para clientes legacy,
- troubleshooting de conectividad remota,
- antecedente de decisiones anteriores,
- base comparativa para justificar la evolución a `print_jobs`.

---

## 15. Próximos pasos

Con esta arquitectura definida, la siguiente etapa consiste en diseñar e implementar un Print Bridge real para Windows con foco en:

- robustez,
- tolerancia a fallos,
- reintentos controlados,
- logging técnico,
- persistencia local mínima,
- integración con impresora térmica real,
- arranque automático como servicio,
- recuperación ante cortes de luz o red.

La implementación del bridge debe respetar esta arquitectura y no reintroducir acoplamientos del modelo anterior.
