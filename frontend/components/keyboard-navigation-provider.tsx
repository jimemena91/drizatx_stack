"use client"

import type React from "react"

import { useKeyboardNavigation } from "@/hooks/use-keyboard-navigation"
import { KeyboardHelpModal } from "@/components/keyboard-help-modal"

export function KeyboardNavigationProvider({ children }: { children: React.ReactNode }) {
  const { showHelp, setShowHelp, allShortcuts } = useKeyboardNavigation()

  return (
    <>
      {children}
      <KeyboardHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} shortcuts={allShortcuts} />
    </>
  )
}
