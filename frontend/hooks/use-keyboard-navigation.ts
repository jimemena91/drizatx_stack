"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  description: string
  action: () => void
  global?: boolean
}

export function useKeyboardNavigation(shortcuts: KeyboardShortcut[] = []) {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)

  // Atajos globales del sistema
  const globalShortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: "h",
        ctrlKey: true,
        description: "Ir a Inicio",
        action: () => router.push("/"),
        global: true,
      },
      {
        key: "d",
        ctrlKey: true,
        description: "Ir a Dashboard",
        action: () => router.push("/dashboard"),
        global: true,
      },
      {
        key: "t",
        ctrlKey: true,
        description: "Ir a Terminal",
        action: () => router.push("/terminal"),
        global: true,
      },
      {
        key: "c",
        ctrlKey: true,
        description: "Ir a Cartelería",
        action: () => router.push("/display"),
        global: true,
      },
      {
        key: "m",
        ctrlKey: true,
        description: "Ir a App Móvil",
        action: () => router.push("/mobile"),
        global: true,
      },
      {
        key: "r",
        ctrlKey: true,
        description: "Ir a Reportes",
        action: () => router.push("/reports"),
        global: true,
      },
      {
        key: "a",
        ctrlKey: true,
        description: "Ir a Administración",
        action: () => router.push("/admin"),
        global: true,
      },
      {
        key: "u",
        ctrlKey: true,
        description: "Ir a Clientes",
        action: () => router.push("/clients"),
        global: true,
      },
      {
        key: "?",
        shiftKey: true,
        description: "Mostrar/Ocultar ayuda de atajos",
        action: () => setShowHelp((prev) => !prev),
        global: true,
      },
      {
        key: "Escape",
        description: "Cerrar modales/ayuda",
        action: () => setShowHelp(false),
        global: true,
      },
    ],
    [router],
  )

  const allShortcuts = useMemo(
    () => [...globalShortcuts, ...shortcuts],
    [globalShortcuts, shortcuts],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignorar si estamos escribiendo en un input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        // Solo permitir Escape para cerrar ayuda
        if (event.key === "Escape") {
          setShowHelp(false)
        }
        return
      }

      const matchingShortcut = allShortcuts.find(
        (shortcut) =>
          shortcut.key.toLowerCase() === event.key.toLowerCase() &&
          !!shortcut.ctrlKey === event.ctrlKey &&
          !!shortcut.altKey === event.altKey &&
          !!shortcut.shiftKey === event.shiftKey,
      )

      if (matchingShortcut) {
        event.preventDefault()
        matchingShortcut.action()
      }
    },
    [allShortcuts],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  // Función para enfocar el primer elemento interactivo
  const focusFirstInteractive = useCallback(() => {
    const firstInteractive = document.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) as HTMLElement
    firstInteractive?.focus()
  }, [])

  // Función para navegar entre elementos con Tab
  const trapFocus = useCallback((container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) as NodeListOf<HTMLElement>

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    container.addEventListener("keydown", handleTabKey)
    return () => container.removeEventListener("keydown", handleTabKey)
  }, [])

  return {
    showHelp,
    setShowHelp,
    allShortcuts,
    focusFirstInteractive,
    trapFocus,
  }
}

// Hook específico para navegación en listas
export function useListNavigation(items: any[], onSelect: (index: number) => void) {
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault()
          if (items.length === 0) {
            return
          }

          setSelectedIndex((prev) => {
            if (prev === -1) {
              return 0
            }

            return (prev + 1) % items.length
          })
          break
        case "ArrowUp":
          event.preventDefault()
          if (items.length === 0) {
            return
          }

          setSelectedIndex((prev) => {
            if (prev === -1) {
              return items.length - 1
            }

            return (prev - 1 + items.length) % items.length
          })
          break
        case "Enter":
        case " ":
          event.preventDefault()
          if (selectedIndex >= 0) {
            onSelect(selectedIndex)
          }
          break
        case "Home":
          event.preventDefault()
          if (items.length === 0) {
            return
          }

          setSelectedIndex(0)
          break
        case "End":
          event.preventDefault()
          if (items.length === 0) {
            return
          }

          setSelectedIndex(items.length - 1)
          break
      }
    },
    [items.length, selectedIndex, onSelect],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (items.length === 0) {
        return -1
      }

      if (prev >= items.length) {
        return items.length - 1
      }

      return prev
    })
  }, [items.length])

  return { selectedIndex, setSelectedIndex }
}
