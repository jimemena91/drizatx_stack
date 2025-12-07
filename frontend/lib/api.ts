import axios from "axios";

/**
 * ✅ Política:
 * - Default seguro: "/api" (mismo origen, sin CORS)
 * - Si NEXT_PUBLIC_API_URL existe pero es ABSOLUTA (http/https), la ignoramos y avisamos en consola.
 * - Si es relativa (empieza con "/"), la usamos.
 */
const RAW = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
const BASE =
  (RAW && RAW.startsWith("/") ? RAW : "/api")
    .replace(/\/+$/, ""); // quita barra final

if (RAW && !RAW.startsWith("/")) {
  // Evitamos CORS por diseño
  // (Si ves este warn en consola, borrá la variable en Vercel o ponela exactamente en /api)
  console.warn("[api] Ignorando NEXT_PUBLIC_API_URL absoluta (evita CORS):", RAW);
}

export const api = axios.create({
  baseURL: BASE,          // -> p.ej. "/api"
  timeout: 10000,
  headers: { "X-Requested-With": "XMLHttpRequest" },
  withCredentials: false, // cambiar a true solo si usás cookies/sesión
});

// Asegura que todas las URLs empiecen con "/"
api.interceptors.request.use((cfg) => {
  if (cfg.url && !cfg.url.startsWith("/")) cfg.url = `/${cfg.url}`;
  return cfg;
});

// Helpers (se mantienen)
export const get = <T = unknown>(url: string, config?: Parameters<typeof api.get>[1]) =>
  api.get<T>(url, config).then(r => r.data);

export const post = <T = unknown>(url: string, data?: unknown, config?: Parameters<typeof api.post>[2]) =>
  api.post<T>(url, data, config).then(r => r.data);

export const put = <T = unknown>(url: string, data?: unknown, config?: Parameters<typeof api.put>[2]) =>
  api.put<T>(url, data, config).then(r => r.data);

export const del = <T = unknown>(url: string, config?: Parameters<typeof api.delete>[1]) =>
  api.delete<T>(url, config).then(r => r.data);
