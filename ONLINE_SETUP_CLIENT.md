# 🌐 Alta de nueva instancia online – DrizaTx

Este documento explica, paso a paso, cómo crear una **nueva instancia online** de DrizaTx
para un cliente, usando Docker en un servidor (VPS / dedicado / nube).

> 🔴 Importante:  
> DrizaTx es un sistema **online**.  
> El backend + frontend + base de datos se ejecutan en un **servidor**,  
> y los clientes se conectan desde sus PCs / notebooks / Smart TV con un navegador.

---

## 1️⃣ Requisitos en el servidor

En el **servidor online** donde va a correr DrizaTx necesitás:

- Linux (Ubuntu 22.04+ recomendado).
- Acceso SSH.
- **Docker** y **Docker Compose** instalados.
- **Node.js 20+** (solo si querés ejecutar scripts `npm` directamente en el servidor).
- DNS configurado (opcional pero recomendado):
  - Ejemplo: `martinez.driza.tech` apuntando a la IP del servidor.

Puertos típicos que vas a usar:

- 3010 → Frontend (Next.js).
- 3001 → Backend (NestJS).
- 3306 interno de MySQL (expuesto opcionalmente como 3307 si lo necesitás).

> 💡 En producción, lo ideal es poner un **Nginx / Caddy** adelante escuchando en
> el puerto 80/443 y redirigiendo a los puertos internos de los contenedores.

---

## 2️⃣ Crear carpeta para el cliente en el servidor

Conectate por SSH al servidor y elegí una carpeta base, por ejemplo:

```bash
mkdir -p /opt/driza
cd /opt/driza
Cloná o copiá el repo madre:

bash
Copiar código
git clone <URL_DEL_REPO_MADRE> drizatx-martinez
cd drizatx-martinez
Podés usar un nombre por cliente:
drizatx-martinez, drizatx-ferreteriaX, etc.

3️⃣ Configurar variables de entorno
3.1. Backend – backend/.env
En el servidor:

bash
Copiar código
cd /opt/driza/drizatx-martinez/backend
cp .env.example .env
nano .env
Configurá, por ejemplo:

env
Copiar código
# Puerto interno del backend
PORT=3001

# Base de datos dentro del docker-compose
DATABASE_HOST=db
DATABASE_PORT=3306
DATABASE_USERNAME=driza
DATABASE_PASSWORD=DrizaDB_2025
DATABASE_NAME=drizatx_martinez    # nombre de DB propio para este cliente

# URL(s) válidas del frontend
FRONTEND_URLS=https://martinez.driza.tech,http://localhost:3010

# JWT
JWT_SECRET=driza-super-secret-2025
JWT_EXPIRES_IN=1d
✅ Regla: usá un nombre de base de datos distinto por cliente
(drizatx_martinez, drizatx_perez, etc.) para separarlos.

3.2. Frontend – frontend/.env.local
bash
Copiar código
cd /opt/driza/drizatx-martinez/frontend
cp .env.local.example .env.local
nano .env.local
Configurar:

env
Copiar código
NEXT_PUBLIC_API_MODE=true
NEXT_PUBLIC_API_URL=http://backend:3001   # dentro de Docker se puede usar el nombre de servicio
NEXT_PUBLIC_API_TIMEOUT_MS=15000
NEXT_PUBLIC_API_HEALTHCHECK_PATH=/api/health
NEXT_PUBLIC_API_HEALTHCHECK_TIMEOUT_MS=5000
NEXT_PUBLIC_DEMO_MODE=0

# URL pública de acceso al frontend
NEXT_PUBLIC_BASE_URL=https://martinez.driza.tech

NEXT_PUBLIC_SMS_ENABLED=false
NEXT_PUBLIC_PUSH_ENABLED=false
🔁 Si vas a exponer el backend también por dominio (ej. https://api-martinez.driza.tech),
entonces poné NEXT_PUBLIC_API_URL=https://api-martinez.driza.tech.

4️⃣ Ajustar docker-compose.yml para producción online
En la raíz del proyecto del cliente:

bash
Copiar código
cd /opt/driza/drizatx-martinez
nano docker-compose.yml
Ejemplo base adaptado a producción:

yaml
Copiar código
services:
  db:
    image: mysql:8.0
    container_name: drizatx-mysql-martinez
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: DrizaRootPass_2025
      MYSQL_DATABASE: drizatx_martinez
      MYSQL_USER: driza
      MYSQL_PASSWORD: DrizaDB_2025
    ports:
      # ⚠️ Opcional en servidor. Solo exponer si necesitás conectarte desde fuera.
      # - "3307:3306"
    command:
      - --default-authentication-plugin=mysql_native_password
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --sql-mode=
      - --innodb_strict_mode=0
    volumes:
      - drizatx-mysql-data-martinez:/var/lib/mysql

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: drizatx-backend-martinez
    restart: unless-stopped
    depends_on:
      - db
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_HOST: db
      DATABASE_PORT: 3306
      DATABASE_USERNAME: driza
      DATABASE_PASSWORD: DrizaDB_2025
      DATABASE_NAME: drizatx_martinez
      FRONTEND_URLS: https://martinez.driza.tech
      JWT_SECRET: "driza-super-secret-2025"
    ports:
      - "3001:3001"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: drizatx-frontend-martinez
    restart: unless-stopped
    depends_on:
      - backend
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_MODE: "true"
      NEXT_PUBLIC_API_URL: "http://backend:3001"
      NEXT_PUBLIC_BASE_URL: "https://martinez.driza.tech"
      NEXT_PUBLIC_SMS_ENABLED: "false"
      NEXT_PUBLIC_PUSH_ENABLED: "false"
    ports:
      - "3010:3000"

volumes:
  drizatx-mysql-data-martinez:
✅ En un escenario más avanzado, podés no exponer los puertos 3001/3010 directamente
y dejar que Nginx/Caddy haga de proxy en 80/443 hacia los contenedores.

5️⃣ Instalar dependencias (primera vez en el servidor)
Solo la primera vez que prepares este proyecto en el servidor:

bash
Copiar código
cd /opt/driza/drizatx-martinez

npm install
cd frontend && npm install
cd ../backend && npm install
cd ..
(En entornos puramente Docker podés saltártelo, pero viene bien para ejecutar
scripts o builds manuales si los necesitás.)

6️⃣ Levantar la instancia online (Docker)
Desde la raíz del proyecto del cliente:

bash
Copiar código
cd /opt/driza/drizatx-martinez
npm run docker:up
Ver logs:

bash
Copiar código
npm run docker:logs
Parar los servicios:

bash
Copiar código
npm run docker:down
7️⃣ Configurar dominio y HTTPS
7.1. DNS
En tu proveedor de dominios:

Crear un registro A:

martinez.driza.tech → IP pública del servidor.

Esperar a que se propaguen los DNS.

7.2. Nginx / Caddy (opcional pero recomendado)
Lo ideal es poner un proxy inverso que:

Escuche en 80/443.

Redirija https://martinez.driza.tech → http://localhost:3010.

(Opcional) https://api-martinez.driza.tech → http://localhost:3001.

Gestione certificados HTTPS (Let’s Encrypt).

Ejemplo simple de Nginx (solo referencia):

nginx
Copiar código
server {
    server_name martinez.driza.tech;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
Luego usás Certbot o similar para el certificado SSL.

8️⃣ Acceder a la instancia online
Una vez que:

Docker está corriendo.

DNS propagado.

(Opcional) Nginx / HTTPS configurado.

Podés entrar a:

Frontend: https://martinez.driza.tech

Backend (si lo exponés por dominio): https://api-martinez.driza.tech/api/docs

9️⃣ Credenciales iniciales y permisos
El sistema crea un usuario:

Usuario: superadmin

Contraseña: Driza123!

Con este usuario podés:

Ver y editar permisos (ACL).

Crear roles adicionales.

Crear operadores y asignar servicios.

Configurar textos del display, etc.

🧠 Regla de oro:
superadmin siempre debe tener acceso total.
Es la cuenta “llave maestra” para recuperar acceso en caso de problemas.

🔁 Flujo resumido para una nueva instancia online
En el servidor, crear carpeta: /opt/driza/drizatx-CLIENTE.

Clonar repo madre dentro de esa carpeta.

Configurar:

backend/.env (DB, JWT, FRONTEND_URLS).

frontend/.env.local (API URL, BASE_URL).

docker-compose.yml (nombres de contenedor, DB, puertos, volumen).

Instalar dependencias la primera vez (npm install en raíz, frontend, backend).

Levantar con npm run docker:up.

Configurar DNS (cliente.driza.tech → IP del servidor).

(Opcional) Configurar Nginx / HTTPS.

Acceder como superadmin / Driza123! y hacer la configuración comercial del cliente.