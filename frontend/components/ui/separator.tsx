"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cn } from "@/lib/utils"

type SeparatorProps = React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  variant?: "default" | "muted" | "destructive"
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  variant = "default",
  ...props
}: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      data-variant={variant}
      className={cn(
        // dimensiones según orientación
        "shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
        // paleta por variante
        "data-[variant=default]:bg-border",
        "data-[variant=muted]:bg-muted-foreground/20",
        "data-[variant=destructive]:bg-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
