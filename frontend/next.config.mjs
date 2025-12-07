// next.config.mjs

function normalizeUrl(value) {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed.replace(/\/$/, "");
}

const BACKEND_URL =
  normalizeUrl(process.env.BACKEND_URL) ??
  normalizeUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ??
  normalizeUrl(process.env.NEXT_PUBLIC_API_URL);

if (!BACKEND_URL) {
  throw new Error(
    "No se encontró una URL absoluta para el backend. Define BACKEND_URL, NEXT_PUBLIC_API_BASE_URL o NEXT_PUBLIC_API_URL con un valor que comience con http:// o https://.",
  );
}

const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
    ];
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
};

export default nextConfig;
