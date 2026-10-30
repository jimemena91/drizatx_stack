import type { CSSProperties } from "react"
import styles from "./halloween-decorations.module.css"

/**
 * Contención crítica en línea (no depende del CSS module): la capa está fuera del flujo,
 * recortada, detrás del contenido y sin interacción. Así, aunque se edite o se quite el CSS
 * de la decoración, nunca puede empujar, tapar ni desplazar el contenido (tickets/publicidades).
 */
const LAYER_CONTAINMENT: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  pointerEvents: "none",
  zIndex: 0,
  contain: "layout paint",
}

/**
 * Decoración exclusivamente visual: nunca intercepta interacciones.
 * Montar solo cuando el tema resuelto sea "halloween".
 */
export function HalloweenDecorations() {
  return (
    <div className={styles.layer} style={LAYER_CONTAINMENT} aria-hidden="true" data-testid="halloween-decorations">
      <div className={styles.moon} />
      <svg className={`${styles.web} ${styles.webLeft}`} viewBox="0 0 160 160">
        <path d="M0 0 H155 M0 0 V155 M0 0 L145 145 M0 0 L70 160 M0 0 L160 70" />
        <path d="M0 38 Q24 24 38 0 M0 72 Q48 42 72 0 M0 110 Q68 60 110 0 M0 148 Q95 78 148 0" />
      </svg>
      <svg className={`${styles.web} ${styles.webRight}`} viewBox="0 0 160 160">
        <path d="M0 0 H155 M0 0 V155 M0 0 L145 145 M0 0 L70 160 M0 0 L160 70" />
        <path d="M0 38 Q24 24 38 0 M0 72 Q48 42 72 0 M0 110 Q68 60 110 0 M0 148 Q95 78 148 0" />
      </svg>
      <svg className={`${styles.bat} ${styles.batOne}`} viewBox="0 0 60 30">
        <path d="M30 14 25 8 20 13 11 5 0 8 7 16 3 25 17 20 26 23 30 18 34 23 43 20 57 25 53 16 60 8 49 5 40 13 35 8Z" />
      </svg>
      <svg className={`${styles.bat} ${styles.batTwo}`} viewBox="0 0 60 30">
        <path d="M30 14 25 8 20 13 11 5 0 8 7 16 3 25 17 20 26 23 30 18 34 23 43 20 57 25 53 16 60 8 49 5 40 13 35 8Z" />
      </svg>
      <div className={styles.fog} />
      <svg className={styles.pumpkin} viewBox="0 0 80 70">
        <path d="M40 14V4m0 9c-29-18-49 9-33 37 8 15 24 17 33 13 9 4 25 2 33-13 16-28-4-55-33-37Z" fill="#EA580C" stroke="#FDBA74" strokeWidth="2"/>
        <path d="m21 36 10-9 3 14H20Zm25 5 3-14 10 9 1 5ZM27 48l13 7 13-7" fill="#1A1022" stroke="#1A1022" strokeWidth="2"/>
      </svg>
      <svg className={`${styles.pumpkin} ${styles.pumpkinRight}`} viewBox="0 0 80 70">
        <path d="M40 14V4m0 9c-29-18-49 9-33 37 8 15 24 17 33 13 9 4 25 2 33-13 16-28-4-55-33-37Z" fill="#EA580C" stroke="#FDBA74" strokeWidth="2"/>
        <path d="m21 36 10-9 3 14H20Zm25 5 3-14 10 9 1 5ZM27 48l13 7 13-7" fill="#1A1022" stroke="#1A1022" strokeWidth="2"/>
      </svg>
    </div>
  )
}
