# Runbook genérico: ejecutar **migraciones MySQL** desde consola (sin proyecto local)

> Guía reutilizable para correr migraciones cuando **no tenés el repo** en tu máquina. Cubre cómo **detectar qué migraciones faltan**, cómo **aplicarlas** por SQL y **registrarlas** en la tabla de tracking del ORM (TypeORM / Sequelize / Prisma), además de verificación y rollback.

---

## 1) Conceptos clave

* **Migración**: cambio versionado del esquema/seed (UP/DOWN).
* **Tabla de tracking**: registro de migraciones **aplicadas** en la DB. Depende del ORM:

  * TypeORM: `migrations` o `typeorm_migrations`.
  * Sequelize: `SequelizeMeta`.
  * Prisma: `_prisma_migrations`.
* **Ambientes**: aplicá primero en **staging** y luego en **producción**.

---

## 2) Prerrequisitos

* Acceso al **cliente MySQL** (`mysql` / `mysql.exe`).
* Credenciales: `<HOST>`, `<PORT>`, `<USER>`, `<DBNAME>` (password vía `-p`).
* Scripts SQL de las migraciones (desde GitHub/Docs/Runbooks).
* Ventana de mantenimiento si el cambio bloquea tablas (p.ej., `ALTER TABLE`).

---

## 3) Conectarte por consola

**Windows (CMD):**

```bat
"C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe" -h <HOST> -P <PORT> -u <USER> -p <DBNAME>
```

**macOS/Linux:**

```bash
mysql -h <HOST> -P <PORT> -u <USER> -p <DBNAME>
```

> Si el proveedor lo requiere, agregar `--ssl-mode=REQUIRED`.

**One-liner (ejecutar y salir):**

```bat
"C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe" -h <HOST> -P <PORT> -u <USER> -p <DBNAME> -e "
-- AQUÍ TU SQL; podés poner varias sentencias separadas por ;
"
```

**Desde archivo .sql:**

```bat
"C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe" -h <HOST> -P <PORT> -u <USER> -p <DBNAME> < .\\db\\migrations\\yyyy-mm-dd-nombre.sql
```

---

## 4) Ver qué migraciones YA se aplicaron (tabla de tracking)

> Primero, encontrá la tabla de tracking según tu ORM.

**Detectar tabla (opciones):**

```sql
SHOW TABLES LIKE 'migrations';
SHOW TABLES LIKE 'typeorm_migrations';
SHOW TABLES LIKE 'SequelizeMeta';
SHOW TABLES LIKE '_prisma_migrations';
```

**Inspeccionar estructura:**

```sql
SHOW CREATE TABLE migrations;          -- o el nombre que corresponda
DESCRIBE migrations;
```

**Listar migraciones aplicadas (según ORM):**

* TypeORM (común):

  ```sql
  SELECT * FROM migrations ORDER BY timestamp;
  -- o
  SELECT * FROM typeorm_migrations ORDER BY id;
  ```
* Sequelize:

  ```sql
  SELECT name FROM SequelizeMeta ORDER BY name;
  ```
* Prisma:

  ```sql
  SELECT migration_name, started_at, finished_at
  FROM _prisma_migrations
  ORDER BY started_at;
  ```

> **Interpretación**: todo lo que aparece aquí ya fue corrido. Lo que exista en tu repositorio pero no en esta tabla, está **pendiente**.

---

## 5) Identificar migraciones **pendientes** (sin repo local)

1. En **GitHub → carpeta de migraciones** del backend (p.ej. `src/migrations/`), listá los archivos.
2. Copiá los **nombres** (suelen incluir timestamp + nombre).
3. Compará con la tabla de tracking (sección 4). Los que **no** figuren → **pendientes**.
4. Respetá el **orden cronológico** de aplicación (por timestamp/nombre).

---

## 6) Ejecutar migraciones **por SQL** (sin CLI del ORM)

1. Abrí el archivo de migración en GitHub (o la doc que contenga el SQL **UP**).
2. En la consola MySQL, **pegá el SQL** y ejecutalo.
3. **Verificá** el efecto:

   ```sql
   SHOW CREATE TABLE <tabla>;
   SHOW COLUMNS FROM <tabla>;
   SHOW INDEX FROM <tabla>;
   ```

> **Transacciones**: si tu cambio lo permite, ejecutá dentro de `START TRANSACTION; ... COMMIT;` para atomicidad. No todos los `ALTER` soportan transacción según motor/engine.

---

## 7) Registrar la migración en la **tabla de tracking** (muy importante)

> Si corrés el SQL **a mano**, el ORM no sabe que ya se aplicó. Registrala para evitar re-ejecuciones.

**TypeORM (tabla típica `migrations`)**

```sql
INSERT INTO migrations (timestamp, name)
VALUES (<TIMESTAMP_NUMERICO>, '<NombreDeMigracion>');
```

**Sequelize (`SequelizeMeta`)**

```sql
INSERT INTO SequelizeMeta (name)
VALUES ('<NombreDeArchivo>.js');
```

**Prisma (`_prisma_migrations`)**

> Prisma espera metadata (checksum, etc.). **Recomendación:** evitar inserciones manuales y preferir `prisma migrate deploy`. Si igual necesitás marcarla, replicá el formato exacto de una fila real de `_prisma_migrations` (riesgoso si no coincide).

**Verificar registro:**

```sql
SELECT * FROM migrations WHERE name = '<NombreDeMigracion>';
-- o la consulta equivalente según ORM
```

> **Tip**: Antes de insertar, mirá `DESCRIBE <tabla_tracking>;` porque diferentes proyectos pueden tener columnas/nombres distintos.

---

## 8) Automatizar con **Railway Deploy Hook**

Si el backend vive en Railway, podés dejar las migraciones corriendo automáticamente después de cada deploy usando un **Deploy Hook**.

1. En Railway, abrí el **servicio del backend**.
2. Ingresá en la pestaña **Settings → Deploy Hooks** y elegí **Add Hook**.
3. Seleccioná el tipo **Post-deploy** (se ejecuta cuando el contenedor ya está construido y el proyecto quedó online).
4. Configurá el comando:

   ```bash
   npm run migration:run:prod
   ```

   *Este script ya existe en `backend/package.json` y usa el bundle compilado (`dist/data-source.js`) que Railway genera durante el build.*

5. Guardá el hook. Railway lo ejecutará automáticamente al finalizar cada deploy.

### Recomendaciones

* **Variables de entorno**: verificá que `DATABASE_URL` (o las variables individuales de conexión) estén definidas en Railway; el comando las necesita para conectar a MySQL.
* **Idempotencia**: TypeORM ignora migraciones ya aplicadas, por lo que el hook es seguro si falla un deploy; solo aplicará las pendientes.
* **Alertas**: activá notificaciones de fallos de deploy en Railway para enterarte si el hook detecta errores al correr las migraciones.

Con esto el proceso queda automatizado y no depende de ingresar manualmente a la shell de Railway tras cada despliegue.

---

## 9) ¿Qué migraciones faltan en **producción**?

1. Conectate a la base **de producción**.
2. Listá lo aplicado (sección 4) y exportalo (timestamp/nombre).
3. Compará con la lista del repo.
4. Aplicá en orden las **pendientes** (sección 6) y **registralas** (sección 7).

---

## 10) Rollback (DOWN)

* Usá el **SQL DOWN** del archivo de migración.
* Si registraste la migración en la tabla de tracking, **eliminala** si revertís:

  ```sql
  DELETE FROM migrations WHERE name = '<NombreDeMigracion>';
  -- o la tabla equivalente
  ```
* Reintentá después de corregir el SQL o ajustar la ventana de mantenimiento.

---

## 11) Verificación post-migración

* Consultas de estructura: `SHOW CREATE TABLE`, `DESCRIBE`, `SHOW INDEX`.
* Consultas funcionales mínimas (smoke test): `SELECT` simples que usen las columnas/índices nuevos.
* Logs del backend (si ya está desplegado) para descartar errores por esquema.

---

## 12) Buenas prácticas

* **Primero staging**, luego prod.
* **Backups/Snapshots** antes de cambios con riesgo.
* **Ventana** para `ALTER` pesados (pueden bloquear).
* Guardar las migraciones también en **.sql** para ejecución sin entorno.
* Documentar **UP/DOWN**, verificación y responsables.
* Para esquemas grandes: evaluar herramientas online (`pt-online-schema-change`).

---

## 13) Cheatsheet (copiar/pegar)

**Conectar:**

```bat
"C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe" -h <HOST> -P <PORT> -u <USER> -p <DB>
```

**Ver tracking:**

```sql
SHOW TABLES LIKE 'migrations';
SELECT * FROM migrations ORDER BY timestamp;
SELECT name FROM SequelizeMeta ORDER BY name;
SELECT migration_name FROM _prisma_migrations ORDER BY started_at;
```

**Aplicar SQL directo:**

```bat
"C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe" -h <HOST> -P <PORT> -u <USER> -p <DB> -e "
START TRANSACTION;
-- TU SQL UP AQUÍ
COMMIT;"
```

**Registrar (TypeORM/Sequelize):**

```sql
INSERT INTO migrations (timestamp, name) VALUES (<TS>, '<Nombre>');
INSERT INTO SequelizeMeta (name) VALUES ('<Archivo>.js');
```

**Rollback:**

```sql
-- SQL DOWN de la migración
DELETE FROM migrations WHERE name = '<Nombre>'; -- según ORM
```

---

**Este runbook es 100% genérico.** Añadí solo las tablas de tracking más comunes; si tu proyecto usa otra, inspeccionala con `SHOW TABLES` y `SHOW CREATE TABLE` y adaptá el paso 7.
