# DrizaTx – Runbook de Instalación y Recovery del Print Bridge

## 1. Objetivo

Este documento describe cómo instalar, configurar, validar y operar el Print Bridge de DrizaTx en una PC Windows del cliente donde está conectada la impresora térmica.

El objetivo es que el bridge pueda operar de forma estable, desatendida y recuperable, consumiendo trabajos desde la cola persistente `print_jobs` del backend.

Este runbook está pensado para:

- instalaciones nuevas,
- validaciones técnicas,
- soporte operativo,
- recuperación ante incidentes.

---

## 2. Alcance

Este runbook cubre:

- prerequisitos,
- instalación local,
- configuración básica,
- validación de conectividad,
- validación de impresora,
- operación normal,
- diagnóstico,
- recovery ante fallos comunes.

No cubre en detalle:

- desarrollo interno del bridge,
- cambios de arquitectura backend,
- promociones de rama a main o producción.

---

## 3. Arquitectura resumida

Flujo operativo esperado:

`Terminal -> Backend -> print_jobs -> Print Bridge -> impresora térmica`

Principios:

- el backend persiste primero,
- el bridge hace `claim`,
- el bridge imprime localmente,
- el bridge reporta `printed` o `failed`,
- los jobs stale pueden recuperarse.

---

## 4. Prerequisitos

## 4.1 En backend / VPS
Debe existir un entorno backend funcionando con:

- módulo de print operativo,
- tabla `print_jobs`,
- endpoints de impresión disponibles,
- conectividad accesible desde la PC cliente.

## 4.2 En la PC Windows
Debe existir:

- Windows operativo,
- impresora térmica instalada,
- driver funcional si aplica,
- permisos para instalar el bridge,
- conectividad hacia el backend,
- reloj del sistema correcto.

## 4.3 Validaciones previas recomendadas
Antes de instalar el bridge conviene verificar:

- que Windows imprima una página de prueba,
- que la impresora aparezca correctamente en el sistema,
- que el backend responda,
- que el bridge pueda llegar al backend,
- que no haya conflictos de firewall o proxy.

---

## 5. Datos mínimos a relevar por cliente

Antes de la instalación registrar:

- nombre del cliente,
- sucursal,
- nombre exacto de la impresora en Windows,
- tipo de conexión de impresora,
- modo de impresión previsto,
- URL del backend,
- bridgeId asignado,
- credenciales o token del bridge,
- ubicación física de la PC,
- contacto técnico responsable.

### Motivo
Esto evita configuraciones improvisadas y mejora el soporte posterior.

---

## 6. Instalación del bridge

## 6.1 Carpeta recomendada
Definir una carpeta estable de instalación, por ejemplo:

```text
C:\DrizaTx\PrintBridge
