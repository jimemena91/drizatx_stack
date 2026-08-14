"use client"

type SessionIdleWarningProps = {
  open: boolean
  remainingSeconds: number
  onContinue: () => void
}

function formatRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function SessionIdleWarning({
  open,
  remainingSeconds,
  onContinue,
}: SessionIdleWarningProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-idle-title"
      aria-describedby="session-idle-description"
    >
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white p-8 text-center shadow-2xl sm:p-10">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl font-bold text-amber-700"
          aria-hidden="true"
        >
          ?
        </div>

        <h2
          id="session-idle-title"
          className="text-3xl font-bold tracking-tight text-slate-950"
        >
          ¿Seguís ahí?
        </h2>

        <p
          id="session-idle-description"
          className="mx-auto mt-3 max-w-md text-base leading-6 text-slate-600"
        >
          No detectamos actividad durante un tiempo. Por seguridad, tu sesión
          se cerrará automáticamente si no confirmás que seguís trabajando.
        </p>

        <div className="my-8">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-slate-500">
            La sesión se cerrará en
          </p>

          <div
            className="font-mono text-6xl font-bold tabular-nums tracking-tight text-slate-950"
            aria-live="polite"
            aria-atomic="true"
          >
            {formatRemainingTime(remainingSeconds)}
          </div>
        </div>

        <button
          type="button"
          autoFocus
          onClick={onContinue}
          className="min-h-14 w-full rounded-2xl bg-slate-950 px-6 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
        >
          Sí, continuar sesión
        </button>

        <p className="mt-4 text-sm text-slate-500">
          Al continuar volverás exactamente donde estabas.
        </p>
      </div>
    </div>
  )
}
