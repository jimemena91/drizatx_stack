"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Variantes pensadas para la paleta ATLITUDE:
 * - default      → neutro (card)
 * - destructive  → error / crítico (usa --destructive)
 * - primary      → confirmación / éxito (usa --primary)
 * - secondary    → info suave (usa --secondary)
 * - accent       → aviso/notice (usa --accent)
 */
const alertVariants = cva(
  [
    "relative w-full rounded-lg",
    "border border-border/60",
    "px-4 py-3 text-sm",
    // Layout si hay ícono al principio
    "grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start",
    // Ícono heredando color
    "[&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
    // Base (neutro coherente con el theme)
    "bg-card text-card-foreground",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "",

        // Usa tokens del tema para cada estado
        destructive:
          "text-destructive bg-destructive/10 border-destructive/30 [&>svg]:text-destructive *:data-[slot=alert-description]:text-destructive/90",

        primary:
          "text-primary bg-primary/10 border-primary/30 [&>svg]:text-primary *:data-[slot=alert-description]:text-current/90",

        secondary:
          "text-secondary-foreground bg-secondary/10 border-secondary/30 [&>svg]:text-secondary-foreground *:data-[slot=alert-description]:text-current/90",

        accent:
          "text-accent-foreground bg-accent/10 border-accent/30 [&>svg]:text-accent-foreground *:data-[slot=alert-description]:text-current/90",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

type AlertProps = React.ComponentProps<"div"> & VariantProps<typeof alertVariants>

function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 min-h-4 line-clamp-1 font-medium tracking-tight", className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        // Neutro por defecto (las variantes lo ajustan a `current`)
        "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
