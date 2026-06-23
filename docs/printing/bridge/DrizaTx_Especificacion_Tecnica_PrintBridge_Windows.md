# DrizaTx – Especificación Técnica del Print Bridge para Windows

## 1. Objetivo

Definir el diseño técnico del Print Bridge real para Windows que consumirá trabajos de impresión desde la arquitectura basada en `print_jobs`, ejecutará la impresión física en una impresora térmica local y reportará el resultado al backend de DrizaTx.

El bridge debe diseñarse con foco en:

- robustez,
- tolerancia a fallos,
- recuperabilidad,
- trazabilidad,
- mantenibilidad,
- operación estable en entornos cliente.

No se considera un script auxiliar ni una app manual, sino un componente técnico formal del sistema de impresión distribuida.

---

## 2. Alcance

Este documento cubre:

- responsabilidades del bridge,
- componentes internos,
- flujo técnico de procesamiento,
- estados locales,
- manejo de errores,
- política de reintentos,
- persistencia local mínima,
- configuración,
- logging,
- recuperación ante reinicio o cortes.

No cubre todavía:

- instalador final,
- interfaz gráfica,
- autoupdate,
- consola de administración,
- soporte multiimpresora avanzado.

---

## 3. Principios de diseño

## 3.1 El backend es la fuente de verdad
El bridge ejecuta trabajos, pero no define el estado de negocio principal.

## 3.2 El bridge debe ser pull-based
El backend no empuja directamente trabajos como mecanismo principal.  
El bridge consulta, reclama y procesa.

## 3.3 La impresión física no debe depender de memoria volátil
Debe existir persistencia local mínima para tolerar reinicios, caídas o cortes de luz.

## 3.4 No debe haber reimpresión automática ciega
Si existe posibilidad razonable de que un trabajo ya haya sido enviado al spooler o a la impresora, no debe reimprimirse automáticamente sin política explícita.

## 3.5 Debe priorizarse la auditabilidad
Cada job procesado debe dejar trazabilidad suficiente para diagnóstico local y correlación con backend.

---

## 4. Responsabilidades del bridge

El Print Bridge debe:

- consultar trabajos disponibles,
- reclamar un job cuando tenga capacidad de proceso,
- transformar el payload recibido al formato imprimible,
- ejecutar la impresión física,
- informar éxito o error al backend,
- registrar logs locales técnicos,
- tolerar fallos transitorios de red,
- recuperarse ante reinicios,
- evitar duplicación física de tickets.

El Print Bridge no debe:

- inventar estados de negocio,
- decidir reimpresiones por cuenta propia sin política definida,
- actuar como única fuente de trazabilidad,
- depender de intervención manual para operar normalmente.

---

## 5. Proceso técnico esperado

## 5.1 Inicio del servicio
Al iniciar, el bridge debe:

1. cargar configuración local,
2. inicializar logger,
3. inicializar persistencia local,
4. validar conectividad básica,
5. validar disponibilidad de impresora configurada,
6. revisar estado local pendiente de jobs anteriores,
7. iniciar loop de polling.

## 5.2 Loop de polling
En operación normal el bridge debe:

1. consultar si tiene capacidad disponible,
2. invocar `POST /print-jobs/claim`,
3. recibir un job o respuesta vacía,
4. persistir localmente que el job fue tomado,
5. procesarlo,
6. informar resultado,
7. continuar el ciclo.

## 5.3 Cierre del job
Luego de imprimir, el bridge debe:

- reportar `printed` si el envío fue exitoso,
- reportar `failed` si hubo error definitivo,
- reintentar solo el reporte si la impresión ocurrió pero falló la comunicación de confirmación.

---

## 6. Componentes internos recomendados

## 6.1 BridgeWorker
Responsable del ciclo principal del servicio.

Funciones:
- arranque,
- polling,
- coordinación general,
- shutdown ordenado.

## 6.2 ClaimClient
Cliente HTTP encargado de interactuar con el backend.

Funciones:
- solicitar claim,
- informar `printed`,
- informar `failed`,
- ejecutar reintentos de red.

## 6.3 PrintExecutor
Responsable de la impresión física.

Funciones:
- recibir el payload,
- renderizar o preparar contenido,
- enviarlo a la impresora,
- capturar resultado técnico.

## 6.4 LocalStateStore
Persistencia local mínima del bridge.

Funciones:
- guardar job en curso,
- registrar estado técnico local,
- persistir eventos críticos,
- permitir recuperación al reiniciar.

## 6.5 DiagnosticsService
Responsable del estado interno y soporte.

Funciones:
- informar última conexión,
- última impresión exitosa,
- último error,
- impresora configurada,
- salud general del bridge.

---

## 7. Estados locales del bridge

Además del estado remoto en `print_jobs`, el bridge debe manejar estados técnicos locales.

Estados sugeridos:

- `claimed_remote`
- `rendering`
- `printing`
- `printed_pending_ack`
- `failed_pending_ack`
- `acked`

## 7.1 `claimed_remote`
El backend asignó el job al bridge.

## 7.2 `rendering`
El bridge está preparando el contenido imprimible.

## 7.3 `printing`
El bridge está ejecutando el envío real a impresora.

## 7.4 `printed_pending_ack`
La impresión fue aceptada técnicamente, pero todavía no pudo confirmarse al backend.

## 7.5 `failed_pending_ack`
Se detectó un error técnico, pero aún no pudo reportarse al backend.

## 7.6 `acked`
El resultado ya fue informado y aceptado por el backend.

---

## 8. Persistencia local mínima

El bridge no debe depender solo de memoria en RAM.

Debe persistir al menos:

- `bridgeId`,
- configuración básica activa,
- job actual en curso,
- estado técnico local del job,
- timestamp de inicio de procesamiento,
- cantidad de reintentos de comunicación,
- último error técnico,
- últimos eventos relevantes.

### Implementación sugerida
Persistencia liviana local con SQLite o journal estructurado.

### Motivo
Permite recuperación ante:

- cierre inesperado,
- reinicio de Windows,
- corte de luz,
- caída del proceso,
- pérdida de conectividad temporal.

---

## 9. Política de reintentos

No todos los errores deben tratarse igual.

## 9.1 Errores transitorios
Ejemplos:

- timeout al backend,
- pérdida temporal de red,
- backend momentáneamente no disponible,
- spooler momentáneamente ocupado.

Acción:
- retry automático con backoff exponencial,
- sin saturar red ni impresora.

## 9.2 Errores persistentes
Ejemplos:

- impresora inexistente,
- nombre de impresora inválido,
- driver roto,
- formato no soportado.

Acción:
- informar `failed`,
- dejar traza local clara,
- no entrar en loop infinito.

## 9.3 Errores ambiguos
Ejemplo:

- el trabajo pudo haberse enviado al spooler, pero falló la confirmación al backend.

Acción:
- no reimprimir automáticamente,
- guardar estado `printed_pending_ack`,
- reintentar solo la confirmación al backend.

---

## 10. Política anti-duplicación

La prioridad operativa es evitar tickets físicos duplicados.

### Regla central
Si un trabajo ya pudo haber sido aceptado por la cadena de impresión local, no debe reimprimirse automáticamente.

### Consecuencias técnicas
- retry de red no implica retry de impresión,
- pérdida de ACK no implica fallo físico,
- reimpresión debe ser controlada y auditable.

---

## 11. Estrategia de impresión

El bridge debe abstraer la impresión física para soportar distintas implementaciones.

## 11.1 Modo RAW / ESC-POS
Adecuado para impresoras térmicas compatibles.

Ventajas:
- mayor control,
- mejor performance,
- posibilidad de corte y formato fino.

## 11.2 Modo driver-rendered
Adecuado para entornos Windows con impresora configurada por driver.

Ventajas:
- mayor compatibilidad,
- implementación más simple en algunos clientes.

### Recomendación arquitectónica
Separar:

- `Renderer`
- `Transport`

para no acoplar formato de ticket y mecanismo físico de envío.

---

## 12. Configuración local

La configuración del bridge debe ser externa al código.

Campos mínimos sugeridos:

- `backendBaseUrl`
- `bridgeId`
- `bridgeSecret` o token
- `printerName`
- `printMode`
- `pollIntervalMs`
- `maxConcurrentJobs`
- `retryPolicy`
- `logLevel`

### Motivo
Permite adaptar instalación por cliente sin recompilar ni tocar código fuente.

---

## 13. Logging y diagnóstico

El bridge debe registrar logs estructurados locales.

Campos recomendados:

- timestamp,
- level,
- bridgeId,
- jobId,
- printerName,
- action,
- result,
- errorCode,
- errorMessage,
- correlationId.

### Requisitos adicionales
- rotación de logs,
- facilidad de inspección,
- diagnóstico claro ante fallos.

---

## 14. Recuperación ante reinicio

Cuando el bridge reinicia, debe:

1. cargar el último estado local,
2. detectar si había un job en curso,
3. decidir si debe:
   - reintentar solo ACK,
   - informar fallo,
   - quedar pendiente de revisión,
4. reanudar operación normal sin duplicar impresión.

### Regla importante
Un job interrumpido durante impresión no debe reimprimirse automáticamente sin una política clara sobre ambigüedad.

---

## 15. Seguridad

El bridge no debe operar sin autenticación hacia el backend.

Mínimos esperados:

- `bridgeId`,
- secreto o token por bridge,
- validación del bridge en backend,
- posibilidad de revocar credenciales comprometidas,
- trazabilidad de qué bridge procesó cada job.

---

## 16. Estrategia de despliegue

La implementación recomendada debe correr como servicio de Windows, no como script manual.

### Motivo
Eso mejora:

- arranque automático,
- recuperación tras reinicio,
- operación desatendida,
- robustez productiva.

El bridge debe instalarse como componente estable del entorno cliente.

---

## 17. Validación incremental recomendada

La implementación debe validarse en capas:

### Etapa 1
- claim,
- estado local,
- fake printer,
- logs.

### Etapa 2
- impresión real controlada,
- errores reales,
- confirmaciones.

### Etapa 3
- recuperación ante reinicio,
- hardening,
- operación continua.

### Motivo
Separar la robustez del pipeline de la complejidad del hardware reduce riesgo y facilita diagnóstico.

---

## 18. Próximos pasos

Con esta especificación definida, la siguiente etapa es diseñar el proyecto técnico concreto del bridge:

- stack tecnológico,
- estructura de carpetas,
- clases o módulos,
- contrato JSON,
- secuencia de ejecución,
- plan de implementación paso a paso.

Ese diseño debe respetar esta especificación y mantenerse alineado con la arquitectura oficial basada en `print_jobs`.
