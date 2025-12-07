// lib/resolve-api-base.ts
// Utilidad compartida para normalizar la URL base del backend.
// Evita repetir fallback hardcodeados (como http://localhost:3001)
// y permite inferir un origen razonable a partir de variables de entorno
// o del `window.location` cuando se ejecuta en el navegador.

type ResolveOptions = {
  /**
   * Ruta por defecto que se anexará al origen inferido.
   * Ej: "/api" → devuelve "https://foo/api".
   */
  defaultPath?: string;
  /** Valor a usar en último término si no se pudo inferir origen. */
  fallbackUrl?: string;
};

function getDefaultProtocol(): string {
  const raw = (process.env.NEXT_PUBLIC_API_PROTOCOL ?? process.env.API_PROTOCOL ?? 'http').trim();
  return raw.replace(/:$/, '') || 'http';
}

function getDefaultHost(): string {
  const raw = (process.env.NEXT_PUBLIC_API_HOST ?? process.env.API_HOST ?? 'localhost').trim();
  return raw || 'localhost';
}

function getDefaultPort(): number {
  const raw =
    process.env.NEXT_PUBLIC_API_PORT ??
    process.env.API_PORT ??
    process.env.BACKEND_PORT ??
    process.env.PORT ??
    process.env.NEXT_PUBLIC_DEV_API_PORT;
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3001;
}

function normalizeAbsoluteUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`;
  }

  if (!/^https?:\/\//i.test(candidate)) {
    return null;
  }

  try {
    const url = new URL(candidate);
    const path = url.pathname && url.pathname !== '/' ? url.pathname.replace(/\/$/, '') : '';
    return `${url.origin}${path}`;
  } catch {
    return null;
  }
}

function inferOriginFromWindow(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeAbsoluteUrl(window.location?.origin ?? null);
  } catch {
    return null;
  }
}

function inferOriginFromEnv(): string | null {
  const directEnvCandidates = [
    process.env.NEXT_PUBLIC_API_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.NEXT_PUBLIC_API,
  ];
  for (const candidate of directEnvCandidates) {
    const normalized = normalizeAbsoluteUrl(candidate);
    if (normalized) return normalized;
  }

  const secondaryEnvCandidates = [
    process.env.BACKEND_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
  ];
  for (const candidate of secondaryEnvCandidates) {
    const normalized = normalizeAbsoluteUrl(candidate);
    if (normalized) return normalized;
  }

  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    const normalized = normalizeAbsoluteUrl(
      vercel.startsWith('http://') || vercel.startsWith('https://') ? vercel : `https://${vercel}`,
    );
    if (normalized) return normalized;
  }

  return null;
}

function buildDefaultLocalUrl(): string {
  const host = getDefaultHost();
  const normalizedHost = normalizeAbsoluteUrl(host);
  if (normalizedHost) {
    return normalizedHost;
  }
  const protocol = getDefaultProtocol();
  const port = getDefaultPort();
  return `${protocol}://${host}${port ? `:${port}` : ''}`;
}

function applyDefaultPath(base: string, defaultPath?: string): string {
  if (!defaultPath) return base;
  const normalizedPath = defaultPath.startsWith('/') ? defaultPath : `/${defaultPath}`;
  if (normalizedPath === '/' || normalizedPath.length === 0) {
    return base;
  }
  return `${base}${normalizedPath.replace(/\/$/, '')}`;
}

export function resolveApiBaseUrl(raw?: string | null, options: ResolveOptions = {}): string {
  const { defaultPath, fallbackUrl } = options;

  const direct = normalizeAbsoluteUrl(raw);
  if (direct) {
    return applyDefaultPath(direct, defaultPath);
  }

  const envOrigin = inferOriginFromEnv();
  if (envOrigin) {
    return applyDefaultPath(envOrigin, defaultPath);
  }

  const browserOrigin = inferOriginFromWindow();
  if (browserOrigin) {
    return applyDefaultPath(browserOrigin, defaultPath);
  }

  const fallback = normalizeAbsoluteUrl(fallbackUrl) ?? buildDefaultLocalUrl();
  return applyDefaultPath(fallback.replace(/\/$/, ''), defaultPath);
}

export function resolveApiBaseWithApiPath(raw?: string | null): string {
  return resolveApiBaseUrl(raw, { defaultPath: '/api' });
}

export default resolveApiBaseUrl;
