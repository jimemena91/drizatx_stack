"use client"

import { useEffect } from "react"
import { X, Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { KeyboardShortcut } from "@/hooks/use-keyboard-navigation"

interface KeyboardHelpModalProps {
  isOpen: boolean
  onClose: () => void
  shortcuts: KeyboardShortcut[]
}

export function KeyboardHelpModal({ isOpen, onClose, shortcuts }: KeyboardHelpModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }

    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  if (!isOpen) return null

  const formatShortcut = (shortcut: KeyboardShortcut) => {
    const keys = []
    if (shortcut.ctrlKey) keys.push("Ctrl")
    if (shortcut.altKey) keys.push("Alt")
    if (shortcut.shiftKey) keys.push("Shift")
    keys.push(shortcut.key === " " ? "Space" : shortcut.key)
    return keys.join(" + ")
  }

  const globalShortcuts = shortcuts.filter((s) => s.global)
  const pageShortcuts = shortcuts.filter((s) => !s.global)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto m-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-blue-600" />
            <CardTitle>Atajos de Teclado</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {globalShortcuts.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3 text-gray-900">Navegación Global</h3>
              <div className="space-y-2">
                {globalShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                    <span className="text-sm text-gray-700">{shortcut.description}</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {formatShortcut(shortcut)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pageShortcuts.length > 0 && (
            <div>
              <h3 className="font-semibold text-lg mb-3 text-gray-900">Atajos de Página</h3>
              <div className="space-y-2">
                {pageShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 rounded-lg bg-blue-50">
                    <span className="text-sm text-gray-700">{shortcut.description}</span>
                    <Badge variant="outline" className="font-mono text-xs border-blue-200">
                      {formatShortcut(shortcut)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="font-semibold text-lg mb-3 text-gray-900">Navegación General</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
              <div>
                • <strong>Tab</strong>: Navegar entre elementos
              </div>
              <div>
                • <strong>Shift + Tab</strong>: Navegar hacia atrás
              </div>
              <div>
                • <strong>Enter</strong>: Activar elemento seleccionado
              </div>
              <div>
                • <strong>Escape</strong>: Cerrar modales
              </div>
              <div>
                • <strong>Flechas</strong>: Navegar en listas
              </div>
              <div>
                • <strong>Home/End</strong>: Ir al inicio/final
              </div>
            </div>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-xs text-gray-500">
              Presiona{" "}
              <Badge variant="outline" className="font-mono text-xs">
                Shift + ?
              </Badge>{" "}
              para mostrar/ocultar esta ayuda
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
