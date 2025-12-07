"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        // Track: mezcla de tu bg-muted + propuesta bg-primary/20 (aplica ambos tokens)
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        "bg-primary/20",
        // Estado inválido conservado
        "aria-invalid:bg-destructive/20",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          // Indicator: tu rounded + transición; ancho completo (como figma) para usar translate
          "h-full w-full flex-1 rounded-full bg-primary transition-all",
          // Estado inválido conservado
          "aria-invalid:bg-destructive"
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
