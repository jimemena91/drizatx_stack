// frontend/components/ThemeToggle.tsx
"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Switch } from "@/components/ui/switch"

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = theme === "dark" || (theme === "system" && systemTheme === "dark")
  const onToggle = (checked: boolean) => setTheme(checked ? "dark" : "light")

  return (
    <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 backdrop-blur-sm">
      <Sun className="size-4 text-white/80" />
      {mounted ? (
        <Switch
          aria-label="Cambiar tema"
          checked={isDark}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-switch-background"
        />
      ) : (
        <div className="h-[1.15rem] w-8 rounded-full bg-white/20" />
      )}
      <Moon className="size-4 text-white/80" />
    </div>
  )
}

export default ThemeToggle
