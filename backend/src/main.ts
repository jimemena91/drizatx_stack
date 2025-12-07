import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { DataSource } from "typeorm"; // ⬅️ para logs de DB
import * as bodyParser from "body-parser";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Permitir cargas más grandes para material promocional (videos/imágenes en data URI)
  const MEDIA_PAYLOAD_LIMIT = "16mb"; // 10 MB de archivo ~ 13.3 MB base64; usamos un margen seguro
  app.use(bodyParser.json({ limit: MEDIA_PAYLOAD_LIMIT }));
  app.use(bodyParser.urlencoded({ limit: MEDIA_PAYLOAD_LIMIT, extended: true }));

  app.setGlobalPrefix("api");

  // Lee URLs permitidas desde env (separadas por coma)
  const normalizeOrigin = (origin: string): string => origin.replace(/\/+$/, "");

  const FRONTEND_URLS = (process.env.FRONTEND_URLS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
    .map(normalizeOrigin);

  const DEFAULT_ALLOWED_ORIGINS: (string | RegExp)[] = [
    /\.vercel\.app$/, // cualquier subdominio vercel.app
    /^https:\/\/drizatx-main-git-[\w-]+-jimemena91s-projects\.vercel\.app$/, // despliegues vercel del repo
    /^(http|https):\/\/localhost:\d+$/, // dev local
    /^(http|https):\/\/127\.0\.0\.1:\d+$/, // dev local
  ];

  const allowedOrigins: (string | RegExp)[] = [
    ...FRONTEND_URLS,
    ...DEFAULT_ALLOWED_ORIGINS,
  ];

  const isOriginAllowed = (origin: string): boolean => {
    const normalizedOrigin = normalizeOrigin(origin);

    return allowedOrigins.some(allowed =>
      allowed instanceof RegExp
        ? allowed.test(normalizedOrigin)
        : allowed === normalizedOrigin,
    );
  };

  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      if (!origin || isOriginAllowed(origin)) {
        return callback(null, true);
      }

      console.warn("[CORS] Origin bloqueado:", origin);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "content-type",
      "authorization",
      "x-requested-with",
      "accept",
      "origin",
    ],
    exposedHeaders: ["content-length", "x-request-id"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };

  app.enableCors(corsOptions);

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle("DRIZATX API")
    .setDescription("Documentación de endpoints del backend")
    .setVersion("1.0")
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDoc);

  // 👇 ACÁ está la parte importante para Railway / Docker
  const port = parseInt(process.env.PORT ?? "3000", 10);
  await app.listen(port, "0.0.0.0");

  console.log(`🚀 Backend NestJS corriendo en http://0.0.0.0:${port}`);
  console.log(`📚 Documentación API en http://0.0.0.0:${port}/api/docs`);

  // 🔎 Logs para confirmar a qué DB se conecta realmente TypeORM
  try {
    const ds = app.get(DataSource);
    const opts = ds.options as any;

    console.log("[DB configured]", {
      type: opts.type,
      host: opts.host,
      port: opts.port,
      db: opts.database,
      user: opts.username,
      url: (opts as any).url, // cuando se configuró con DATABASE_URL/MYSQL_URL
    });

    console.log("[DB env]", {
      DATABASE_URL: process.env.DATABASE_URL ? "<set>" : "<unset>",
      MYSQL_URL: process.env.MYSQL_URL ? "<set>" : "<unset>",
      MYSQL_PUBLIC_URL: process.env.MYSQL_PUBLIC_URL ? "<set>" : "<unset>",
      DB_HOST: process.env.DB_HOST ?? "<unset>",
      DB_PORT: process.env.DB_PORT ?? "<unset>",
      DB_NAME: process.env.DB_NAME ?? "<unset>",
      DB_USERNAME: process.env.DB_USERNAME ?? "<unset>",
    });

    const [row] = await ds.query(
      "SELECT DATABASE() AS db, @@hostname AS host, @@version AS version",
    );
    console.log("[DB runtime]", row);

    // 🧪 Comparador de password (activar con DEBUG_LOGIN_USER + DEBUG_LOGIN_PASS)
    try {
      const debugUser = process.env.DEBUG_LOGIN_USER; // ej: 'admin' o 'admin@...'
      const debugPass = process.env.DEBUG_LOGIN_PASS; // ej: 'admin123'
      if (debugUser && debugPass) {
        const [authRow] = await ds.query(
          `SELECT password_hash FROM operators
           WHERE TRIM(username)=? OR LOWER(TRIM(email))=LOWER(?)
           LIMIT 1`,
          [debugUser, debugUser],
        );
        if (!authRow) {
          console.log("[AUTH COMPARE] user not found:", debugUser);
        } else if (!authRow.password_hash) {
          console.log("[AUTH COMPARE] user has no hash");
        } else {
          const bcrypt = require("bcryptjs");
          const ok = await bcrypt.compare(
            debugPass,
            String(authRow.password_hash),
          );
          console.log("[AUTH COMPARE]", { user: debugUser, ok });
        }
      }
    } catch (e) {
      console.warn("[AUTH COMPARE] error:", (e as any)?.message);
    }

    // 🧪 Sonda: inspeccionar un usuario (activar con DEBUG_LOGIN_USER)
    try {
      const debugUser = process.env.DEBUG_LOGIN_USER; // ej: 'admin' o 'admin@drizatx.com'
      if (debugUser) {
        const [probeRow] = await ds.query(
          `SELECT id, username, email, CHAR_LENGTH(password_hash) AS hash_len, active
           FROM operators
           WHERE TRIM(username) = ? OR LOWER(TRIM(email)) = LOWER(?)
           LIMIT 1`,
          [debugUser, debugUser],
        );
        console.log("[AUTH PROBE]", {
          query: debugUser,
          row: probeRow ?? null,
        });
      }
    } catch (e) {
      console.warn("[AUTH PROBE] error:", (e as any)?.message);
    }

  } catch (e) {
    console.warn(
      "[DB log] no se pudo obtener información de conexión:",
      (e as any)?.message,
    );
  }
}

// Llamada a la función FUERA de la función, con manejo de error
bootstrap().catch(err => {
  console.error("❌ Error al iniciar la app:", err);
  process.exit(1);
});
