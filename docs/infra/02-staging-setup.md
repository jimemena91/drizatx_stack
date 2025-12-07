# Entorno STAGING – DrizaTx

Este documento describe cómo desplegar la **versión de pruebas online** de DrizaTx
(el entorno STAGING). Acá se testean todos los cambios antes de pasarlos a la
**MADRE** y luego a los clientes.

---

## 1. Requisitos del servidor de STAGING

En el VPS/servidor donde va a vivir STAGING necesitamos:

- Linux (Ubuntu 22.04 o similar)
- Docker
- Docker Compose v2 (`docker compose` ya integrado)
- Git

Verificar:

```bash
docker --version
docker compose version
git --version
