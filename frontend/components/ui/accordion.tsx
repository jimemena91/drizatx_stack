"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown as ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"

function Accordion(
  props: React.ComponentProps<typeof AccordionPrimitive.Root>
) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(
        // Borde sutil que toma de --color-border
        "border-b border-border/60 last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          // Layout
          "flex flex-1 items-start justify-between gap-4 rounded-md py-3 px-2 text-left text-sm font-medium transition-all",
          // Interacción y accesibilidad (usa --ring)
          "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          // Estados
          "hover:bg-muted/40 hover:no-underline",
          "disabled:pointer-events-none disabled:opacity-50",
          // Al abrir: leve énfasis con muted y color primario
          "data-[state=open]:bg-muted/50 data-[state=open]:text-primary",
          // Rotación del ícono al abrir
          "[&[data-state=open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className={cn(
        "overflow-hidden text-sm",
        "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      )}
      {...props}
    >
      <div
        className={cn(
          // Delimita el contenido con un borde superior suave (usa --border)
          "pt-0 pb-4 border-t border-border/50 bg-transparent",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
