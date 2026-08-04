import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DrizaTx Operador",
    short_name: "DrizaTx",
    description: "Aplicación de operadores del sistema de gestión de turnos DrizaTx.",
    start_url: "/operator",
    scope: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#7c3aed",
    orientation: "any",
    icons: [
      {
        src: "/drizatx-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
