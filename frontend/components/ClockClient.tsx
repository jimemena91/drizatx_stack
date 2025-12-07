"use client"
import { useEffect, useState } from "react"

export default function ClockClient({
  locale = "es-AR",
  timeZone,
  hour12 = false,
}: { locale?: string; timeZone?: string; hour12?: boolean }) {
  const [time, setTime] = useState("")

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12,
      ...(timeZone ? { timeZone } : {}),
    })
    const tick = () => setTime(fmt.format(new Date()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [locale, timeZone, hour12])

  return <span>{time}</span>
}
