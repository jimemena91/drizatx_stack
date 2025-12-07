"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        // Base
        "flex items-center gap-2 text-sm leading-none font-medium select-none",
        // Estados deshabilitado (peer / group)
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        // Estados opcionales útiles
        "data-[muted=true]:text-muted-foreground",
        "data-[error=true]:text-destructive",
        // Requerido (opt-in): asterisco accesible
        "data-[required=true]:after:ml-0.5 data-[required=true]:after:text-destructive data-[required=true]:after:content-['*']",
        // Foco accesible cuando el control está dentro del label
        "focus-within:rounded-xs focus-within:ring-[3px] focus-within:ring-ring/50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
