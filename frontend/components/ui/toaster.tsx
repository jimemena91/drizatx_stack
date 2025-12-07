"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider data-slot="toaster-provider">
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} data-slot="toaster-toast" {...props}>
            <div data-slot="toaster-body" className="grid gap-1">
              {title && <ToastTitle data-slot="toaster-title">{title}</ToastTitle>}
              {description && (
                <ToastDescription data-slot="toaster-description">
                  {description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose data-slot="toaster-close" />
          </Toast>
        )
      })}
      <ToastViewport data-slot="toaster-viewport" />
    </ToastProvider>
  )
}
