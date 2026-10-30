import styles from "./halloween-decorations.module.css"

/**
 * Decoración exclusivamente visual: nunca intercepta interacciones.
 * Montar solo cuando el tema resuelto sea "halloween".
 */
export function HalloweenDecorations() {
  return (
    <div className={styles.layer} aria-hidden="true" data-testid="halloween-decorations">
      <div className={styles.skyGlow} />
      <div className={styles.moonHalo} />
      <div className={styles.moon} />
      <svg className={styles.castle} viewBox="0 0 310 210" preserveAspectRatio="xMidYMax meet">
        <path d="M20 208V129H40V100H52V64H65V100H81V155H96V107H110V45H124V107H142V73H155V28H169V73H185V120H197V90H210V55H222V90H240V118H258V77H272V118H291V208Z" />
        <path d="M38 129H78M98 107H141M143 73H185M196 90H241M254 118H291" stroke="#F97316" strokeWidth="2" />
        <path d="M56 55 65 33 74 55M148 24 162 0 176 24M202 52 216 25 230 52M258 75 266 55 275 75" />
        <g fill="#FB923C"><path d="M58 117h8v17h-8zM115 125h9v18h-9zM154 93h10v19h-10zM211 115h9v18h-9zM262 144h8v15h-8z" /></g>
      </svg>
      <svg className={styles.treeLeft} viewBox="0 0 200 240">
        <path d="M95 250V95L55 38 63 24 102 73 120 19 133 12 114 92 176 58 191 58 130 112 110 137V250Z" />
        <path d="M99 143 55 130 29 91 18 90 48 150 98 164M107 192 159 159 181 126 169 118 147 145 105 169" />
      </svg>
      <svg className={styles.treeRight} viewBox="0 0 200 240">
        <path d="M95 250V95L55 38 63 24 102 73 120 19 133 12 114 92 176 58 191 58 130 112 110 137V250Z" />
        <path d="M99 143 55 130 29 91 18 90 48 150 98 164M107 192 159 159 181 126 169 118 147 145 105 169" />
      </svg>
      <div className={styles.groundSilhouette} />
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
