"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Estilos base y layout
        "flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base md:text-sm outline-none transition-[color,box-shadow]",
        "bg-input-background text-foreground border-input shadow-xs",
        // Placeholders y selección coherente
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
        // File input
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:px-2 file:text-sm file:font-medium file:text-foreground",
        // Estados de foco accesibles
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        // Estados inválidos
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        // Disabled
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
