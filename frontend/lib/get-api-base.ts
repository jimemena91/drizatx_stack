// src/lib/get-api-base.ts
import { resolveApiBaseWithApiPath } from "@/lib/resolve-api-base";

export function getApiBase(raw?: string) {
  const candidate =
    raw ??
    (typeof process !== "undefined"
      ? (process as any).env?.NEXT_PUBLIC_API_BASE_URL ||
        (process as any).env?.NEXT_PUBLIC_API_URL ||
        (process as any).env?.NEXT_PUBLIC_API
      : undefined);

  return resolveApiBaseWithApiPath(candidate);
}

export function apiUrl(path: string) {
  const base = getApiBase();
  const clean = path.startsWith("/api/") ? path.slice(5) : path.replace(/^\//, "");
  return `${base}/${clean}`;
}
