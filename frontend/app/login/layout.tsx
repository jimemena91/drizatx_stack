import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Iniciar Sesión - DrizaTx",
  description: "Acceda al Sistema de Gestión de Colas DrizaTx",
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
