// middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Modo DEMO (solo build-time). Si querés alternarlo en runtime,
 * mejor usar una variable sin NEXT_PUBLIC_ y redeploy.
 */
const IS_DEMO = false;

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
      return "/dashboard"; // ✅ dashboard real
  }
}

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
    if (pathname !== "/login") {
      url.searchParams.set("redirect", pathname + (search || ""));
    }
    return NextResponse.redirect(url);
  }

  // 5) Guard por rol (simple y efectivo)
  const role = req.cookies.get("drizatx-role")?.value?.toUpperCase() ?? "";

  // ✅ Si está logueado y cae en "/" (welcome), lo mandamos al dashboard real
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = defaultRouteForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Si el usuario logueado intenta volver a /login, lo llevo a su home por rol
  if (pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = defaultRouteForRole(role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  // OPERADOR: solo /operator* + públicas (ya permitidas arriba)
  if (role === "OPERATOR" || role === "OPERADOR") {
    const isOperatorPath = pathname === "/operator" || pathname.startsWith("/operator/");
    if (!isOperatorPath) {
      const url = req.nextUrl.clone();
      url.pathname = "/operator";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

/**
 * Matcher: excluimos assets estáticos y health.
 */
export const config = {
  matcher: ["/((?!_next|favicon.ico|assets|robots.txt|sitemap.xml|api/health).*)"],
};

