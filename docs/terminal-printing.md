# Configuración de impresión local para la terminal de autoservicio

Este instructivo resume los pasos para que la terminal desplegada en Vercel pueda disparar la impresión física de tickets en tu oficina.

## 1. Preparar el "puente" de impresión
1. **Instalá un servicio local** (puede ser Node.js, Python u otra tecnología) en la computadora donde está conectada la impresora o en un servidor de tu red.
2. El servicio debe exponer un **endpoint HTTP/HTTPS** (por ejemplo, `POST /print`) que reciba el payload del ticket en formato JSON y lo envíe a la impresora mediante la librería adecuada (`node-printer`, `pycups`, etc.).
3. Guardá registros de cada solicitud atendida (fecha, ticket, estado) para facilitar auditorías.

## 2. Exponer el servicio a Internet de forma segura
1. Configurá **NAT/Port Forwarding** o un túnel seguro (Cloudflare Tunnel, Tailscale Funnel, ngrok con dominio propio) para que Vercel pueda contactar al servicio.
2. Asigná una **IP pública fija** o un **DNS dinámico** para que la URL no cambie.
3. Limitá el acceso mediante firewall o lista blanca de IPs, permitiendo únicamente la comunicación desde tu despliegue en Vercel.
4. Usá HTTPS siempre que sea posible; si no, establecé un túnel que proporcione cifrado.

## 3. Configurar DrizaTx
1. Ingresá al **Panel de Administración → Configuración → Terminal de autoservicio**.
2. Copiá en "Webhook de impresión" la URL pública del servicio puente (ej.: `https://impresora.midominio.com/print`).
3. Si tu servicio exige autenticación, generá un token secreto y colocalo en "Token del webhook". DrizaTx lo enviará en el encabezado `Authorization: Bearer <token>`.

## 4. Flujo de impresión
1. Un operador presiona **"Llamar siguiente"** o completa un turno desde el panel.
2. El backend envía un `POST` al webhook configurado con la información del ticket (número, servicio, mensaje para el ciudadano).
3. El servicio puente recibe la solicitud, valida el token y ejecuta la impresión.
4. Registrá cualquier error y reintentos en el puente para poder actuar rápidamente.

## 5. Recomendaciones de seguridad
- Mantener actualizado el sistema operativo y drivers de la PC donde corre el puente.
- Rotar periódicamente el token del webhook y almacenarlo en un gestor de secretos.
- Evitar publicar el servicio sin autenticación o sin cifrado TLS.
- Supervisar los registros para detectar intentos fallidos o accesos sospechosos.

Con estos pasos, la terminal de autoservicio podrá imprimir tickets físicos aun cuando el frontend esté alojado en Vercel.
