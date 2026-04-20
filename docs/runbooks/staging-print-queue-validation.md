# 🖨️ DrizaTx – Print Queue (Staging) Validation Runbook

## 🎯 Objetivo

Validar un sistema de impresión robusto basado en cola persistente que:

- Evita pérdida de tickets
- Tolera cortes de luz o red
- Permite reintentos y recuperación automática
- Desacopla frontend, backend y bridge

---

## 🧱 Arquitectura

Frontend → Backend (NestJS) → MySQL (`print_jobs`) → Bridge → Impresora

---

## 📦 Entidad: `print_jobs`

### Estados

| Estado       | Descripción |
|-------------|------------|
| `pending`    | Esperando ser procesado |
| `processing` | Tomado por el bridge |
| `printed`    | Impreso correctamente |
| `failed`     | Falló impresión |

---

## 🔌 Endpoints

### Crear job
