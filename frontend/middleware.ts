// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Modo DEMO (solo build-time). Si querés alternarlo en runtime,
 * mejor usar una variable sin NEXT_PUBLIC_ y redeploy.
 */
const IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

/**
 * Rutas públicas: no requieren auth/sesión.
 * Ojo: no ponemos "/" para que el home requiera login por defecto.
 */
const PUBLIC_PATHS = [
  "/login",
  "/display",
  "/terminal", // 👈 la terminal es pública
  "/mobile",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/_next",
  "/assets",
  "/public",
  "/api/health",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

/**
 * Punto único para decidir la ruta por defecto según rol.
 * Mantenerlo alineado con lib/auth-utils.ts (getDefaultRouteForRole).
 */
function defaultRouteForRole(roleRaw?: string | null) {
  const role = (roleRaw ?? "").toUpperCase();
  switch (role) {
    case "OPERATOR":
    case "OPERADOR":
      return "/operator";
    case "ADMIN":
    case "SUPERVISOR":
    case "SUPERADMIN":
    default:
      return "/"; // dashboard
  }
}

/**
 * Si más adelante usás JWT en cookie, podés decodificarlo acá.
 * (Dejo el stub para futura migración segura)
 */
// function readJwtPayload(token: string): any | null {
//   try {
//     const base64 = token.split(".")[1];
//     const json = Buffer.from(base64, "base64").toString("utf8");
//     return JSON.parse(json);
//   } catch {
//     return null;
//   }
// }

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1) DEMO: deja pasar todo
  if (IS_DEMO) return NextResponse.next();

  // 2) Público: deja pasar
  if (isPublicPath(pathname)) {
    // Si ya hay sesión y estás en /login, redirigimos al home por rol (UX mejor)
    if (pathname === "/login") {
      const hasAuth = req.cookies.get("drizatx-auth")?.value === "1";
      if (hasAuth) {
        const role = req.cookies.get("drizatx-role")?.value;
        const url = req.nextUrl.clone();
        url.pathname = defaultRouteForRole(role);
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // 3) API y endpoints propios de API: dejar pasar
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 4) Chequeo de sesión mínima mediante cookies (simple)
  const hasAuth = req.cookies.get("drizatx-auth")?.value === "1";

  // Si no hay sesión -> login con redirect al destino
  if (!hasAuth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Evitar redirect loop si por algún motivo pathname ya fuera /login
    if (pathname !== "/login") {
      url.searchParams.set("redirect", pathname + (search || ""));
    }
    return NextResponse.redirect(url);
  }

  // 5) Guard por rol (simple y efectivo)
  const role = req.cookies.get("drizatx-role")?.value?.toUpperCase() ?? "";

  // Si el usuario logueado intenta volver a /login, lo llevo a su home por rol
  if (pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = defaultRouteForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  // OPERADOR: solo /operator* + públicas (ya permitidas arriba)
  if (role === "OPERATOR" || role === "OPERADOR") {
    const isOperatorPath =
      pathname === "/operator" || pathname.startsWith("/operator/");
    if (!isOperatorPath) {
      const url = req.nextUrl.clone();
      url.pathname = "/operator";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Otros roles (ADMIN/SUPERVISOR/SUPERADMIN): por ahora se permite el resto;
  // si querés blindar /admin estrictamente acá, podés agregar validación de permisos.

  return NextResponse.next();
}

/**
 * Matcher: excluimos assets estáticos y health.
 * Nota: no excluimos /api en el matcher porque ya lo tratamos arriba,
 * pero si querés, podés añadirlo acá también.
 */
export const config = {
  matcher: [
    "/((?!_next|favicon.ico|assets|robots.txt|sitemap.xml|api/health).*)",
  ],
};
