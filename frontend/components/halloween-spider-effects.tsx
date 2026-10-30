"use client"

import { useEffect, useRef, useState } from "react"
import styles from "./halloween-spider-effects.module.css"

type Props = {
  enabled: boolean
  isNewTicket: boolean
  /** IDs ordenados de los turnos secundarios visibles, no de la cola en espera. */
  secondaryTicketIds: string[]
}

export function HalloweenSpiderEffects({ enabled, isNewTicket, secondaryTicketIds }: Props) {
  const [callAnimation, setCallAnimation] = useState(0)
  const [listAnimation, setListAnimation] = useState(0)
  const initialized = useRef(false)
  const lastSignature = useRef("")
  const previousCall = useRef(false)
  const signature = secondaryTicketIds.join("|")

  useEffect(() => {
    if (!enabled) {
      previousCall.current = false
      return
    }
    if (isNewTicket && !previousCall.current) {
      setCallAnimation((n) => n + 1)
    }
    previousCall.current = isNewTicket
  }, [enabled, isNewTicket])

  useEffect(() => {
    if (!enabled) {
      initialized.current = false
      lastSignature.current = ""
      return
    }
    if (!initialized.current) {
      initialized.current = true
      lastSignature.current = signature
      return
    }
    if (lastSignature.current !== signature) {
      lastSignature.current = signature
      if (!isNewTicket) setListAnimation((n) => n + 1)
    }
  }, [enabled, signature, isNewTicket])

  if (!enabled) return null

  return (
    <div className={styles.layer} aria-hidden="true">
      {callAnimation > 0 && (
        <div key={`call-${callAnimation}`} className={styles.call}>
          <span className={styles.thread} />
          <span className={styles.spider}>🕷</span>
        </div>
      )}
      {listAnimation > 0 && (
        <span key={`list-${listAnimation}`} className={styles.crossing}>🕷</span>
      )}
    </div>
  )
}
