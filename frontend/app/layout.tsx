// frontend/app/layout.tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { QueueProvider } from "@/contexts/queue-context"
import { AuthProvider } from "@/contexts/auth-context"
import { ToastProvider } from "@/components/toast-provider"
import { KeyboardNavigationProvider } from "@/components/keyboard-navigation-provider"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata: Metadata = {
  title: "DrizaTx - Sistema Integral de Gestión de Colas",
  description: "Optimiza flujos de personas en entornos de atención masiva con tecnología DrizaTx",
  generator: "v0.dev",
}

// 👇 usa `variable` para exponer --font-inter
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* color-scheme ayuda a inputs nativos y UA */}
      <head>
        <meta name="color-scheme" content="dark light" />
      </head>

      {/* next-themes manejará la clase 'dark' sobre <html> automáticamente.
          Mantenemos las clases de fuente y layout en <body>. */}
      <body className={`${inter.variable} font-sans min-h-dvh bg-background text-foreground antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
          <QueueProvider>
            <ToastProvider>
              <KeyboardNavigationProvider>{children}</KeyboardNavigationProvider>
            </ToastProvider>
          </QueueProvider>
        </AuthProvider>
      </ThemeProvider>
      </body>
    </html>
  )
}
