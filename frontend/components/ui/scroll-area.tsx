"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] outline-none transition-[color,box-shadow]",
          // Focus visible accesible (tu estilo + convención Figma)
          "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      <ScrollBar />
      {/* Mantengo el fondo del Corner para integrarlo con la paleta */}
      <ScrollAreaPrimitive.Corner className="bg-background" />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex select-none touch-none p-px transition-colors",
        // Track transparente para superponerse sin invadir contenido
        orientation === "vertical" &&
          "h-full w-2.5 border-l border-l-transparent",
        orientation === "horizontal" &&
          "h-2.5 flex-col border-t border-t-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={cn(
          // Pulgar visible en ambos temas (tu versión más usable)
          "relative flex-1 rounded-full bg-muted-foreground/30",
          "hover:bg-muted-foreground/40",
          "outline outline-1 -outline-offset-1 outline-border/50"
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
