import type { CSSProperties } from "react"

/**
 * Temas visuales de la pantalla de display (/display).
 *
 * El tema activo sale de la configuración `signageTheme` de cada cliente.
 * Para agregar un estilo nuevo: sumar un bloque en DISPLAY_THEMES. No hace
 * falta tocar la pantalla ni el componente de tickets.
 *
 * Reglas:
 * - `header.from` y `header.to` van en hex de 6 dígitos (#RRGGBB): el
 *   encabezado les agrega transparencia concatenando dos dígitos.
 * - Si un tema no define `surface` o `tickets`, esa parte queda con la base
 *   oscura de siempre (tickets ámbar y verdes).
 * - Un valor de `signageTheme` que no figure acá (por ejemplo los históricos
 *   "corporate" o "minimal") cae en "marca": colores de marca del cliente
 *   (`brandPrimaryColor` / `brandSecondaryColor`) sobre la base oscura, que es
 *   exactamente cómo se veía la pantalla antes de existir los temas.
 */

export type DisplayThemeHeader = {
  /** Inicio del degradado del encabezado (#RRGGBB). */
  from: string
  /** Fin del degradado del encabezado (#RRGGBB). */
  to: string
  /** Nombre del comercio, iniciales y visualizador de audio. Por defecto usa `to`. */
  accent?: string
  /** Fecha debajo del reloj. */
  muted?: string
}

export type DisplayThemeSurface = {
  /** Fondo de toda la pantalla (color o degradado CSS). */
  pageBackground: string
  text: string
  mutedText: string
  /** Marco exterior de la lista de turnos. */
  panelBackground: string
  panelBorder: string
  /** Bloque de promociones y mensajes. */
  cardBackground: string
  cardBorder: string
  /** Sombra del bloque de promociones (rgba). Opcional: por defecto, la sombra oscura de siempre. */
  cardShadow?: string
  /** Botones flotantes (audio, volver). */
  buttonBackground: string
  buttonBorder: string
}

/** Colores de una tarjeta de turno. */
export type DisplayTicketPalette = {
  /** Borde de la tarjeta (color o degradado CSS). */
  frame: string
  /** Resplandor alrededor de la tarjeta (rgba). */
  glow: string
  /** Fondo de la tarjeta (color o degradado CSS). */
  background: string
  /** Número, servicio y puesto. */
  text: string
  /** Etiqueta "Llamando" / "Atendido". */
  badgeBackground: string
  badgeText: string
  /** Recuadro del puesto. */
  chipBackground: string
  chipBorder: string
}

export type DisplayThemeTickets = {
  /** Contenedor de la lista de turnos. */
  containerBackground: string
  containerBorder: string
  /** Sombra del contenedor (rgba). Opcional: por defecto, la sombra oscura de siempre. */
  containerShadow?: string
  text: string
  mutedText: string
  /** Aro, destello y ondas al llamar un turno, como "R, G, B". */
  highlightRgb: string
  /** Título "Turnos en llamado". */
  calledLabel: string
  /** Título "Turnos atendidos". */
  attendedLabel: string
  /** El turno que se está llamando (primera tarjeta). */
  hero: DisplayTicketPalette
  /** Otros turnos en llamado. */
  called: DisplayTicketPalette
  /** Turnos atendidos. */
  attended: DisplayTicketPalette
}

export type DisplayThemeDefinition = {
  label: string
  header?: DisplayThemeHeader
  surface?: DisplayThemeSurface
  tickets?: DisplayThemeTickets
}

export const FALLBACK_DISPLAY_THEME_ID = "marca"

export const DISPLAY_THEMES: Record<string, DisplayThemeDefinition> = {
  /** Colores de marca del cliente sobre la base oscura. Es el comportamiento histórico. */
  marca: {
    label: "Colores de marca",
  },

  /** Verde farmacia: el estilo con el que hoy sale Cruz Verde. */
  farmacia: {
    label: "Farmacia",
    header: { from: "#064E3B", to: "#8ED081" },
  },

  /** Azul noche y cian: el estilo con el que hoy sale Casa Martínez. */
  ferreteria: {
    label: "Ferretería",
    header: { from: "#0f172a", to: "#22d3ee" },
  },

  /**
   * Octubre rosa: mes de concientización sobre el cáncer de mama.
   * Fondo rosa claro en toda la pantalla, textos en bordó y el turno
   * que se llama en bordó con número blanco.
   */
  "octubre-rosa": {
    label: "Octubre rosa",
    header: { from: "#9D174D", to: "#DB2777", accent: "#FFFFFF", muted: "#FFFFFF" },
    surface: {
      pageBackground: "linear-gradient(to bottom right, #FBCFE8, #F9A8D4, #F472B6)",
      text: "#500724",
      mutedText: "#831843",
      panelBackground: "rgba(255, 255, 255, 0.28)",
      panelBorder: "rgba(255, 255, 255, 0.65)",
      cardBackground: "rgba(255, 255, 255, 0.4)",
      cardBorder: "rgba(255, 255, 255, 0.65)",
      cardShadow: "rgba(157, 23, 77, 0.22)",
      buttonBackground: "rgba(255, 255, 255, 0.88)",
      buttonBorder: "rgba(190, 24, 93, 0.4)",
    },
    tickets: {
      containerBackground: "rgba(255, 255, 255, 0.45)",
      containerBorder: "rgba(255, 255, 255, 0.75)",
      containerShadow: "rgba(157, 23, 77, 0.22)",
      text: "#500724",
      mutedText: "#831843",
      highlightRgb: "190, 24, 93",
      calledLabel: "#831843",
      attendedLabel: "#9D174D",
      hero: {
        frame: "linear-gradient(to bottom right, #DB2777, #BE185D, #9D174D)",
        glow: "rgba(157, 23, 77, 0.4)",
        background: "linear-gradient(to bottom right, #BE185D, #9D174D, #831843)",
        text: "#FFFFFF",
        badgeBackground: "#FFFFFF",
        badgeText: "#BE185D",
        chipBackground: "rgba(255, 255, 255, 0.18)",
        chipBorder: "rgba(255, 255, 255, 0.75)",
      },
      called: {
        frame: "linear-gradient(to bottom right, #EC4899, #DB2777, #BE185D)",
        glow: "rgba(190, 24, 93, 0.2)",
        background: "linear-gradient(to bottom right, #FFFFFF, #FFF5F9, #FDF2F8)",
        text: "#831843",
        badgeBackground: "#DB2777",
        badgeText: "#FFFFFF",
        chipBackground: "#FCE7F3",
        chipBorder: "rgba(190, 24, 93, 0.5)",
      },
      attended: {
        frame: "linear-gradient(to bottom right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.6))",
        glow: "rgba(157, 23, 77, 0.08)",
        background: "linear-gradient(to bottom right, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.35))",
        text: "#831843",
        badgeBackground: "rgba(131, 24, 67, 0.14)",
        badgeText: "#831843",
        chipBackground: "rgba(255, 255, 255, 0.65)",
        chipBorder: "rgba(157, 23, 77, 0.3)",
      },
    },
  },
}

export type DisplayThemeStyles = {
  page?: CSSProperties
  panel?: CSSProperties
  card?: CSSProperties
  cardInner?: CSSProperties
  text?: CSSProperties
  mutedText?: CSSProperties
  button?: CSSProperties
}

export type DisplayTicketCardStyles = {
  frame: CSSProperties
  glow: CSSProperties
  body: CSSProperties
  badge: CSSProperties
  number: CSSProperties
  service: CSSProperties
  puestoLabel: CSSProperties
  puestoValue: CSSProperties
}

export type DisplayTicketStyles = {
  container: CSSProperties
  pulse: CSSProperties
  wave: CSSProperties
  calledLabel: CSSProperties
  attendedLabel: CSSProperties
  empty: CSSProperties
  emptyText: CSSProperties
  hero: DisplayTicketCardStyles
  called: DisplayTicketCardStyles
  attended: DisplayTicketCardStyles
}

export type ResolvedDisplayTheme = {
  id: string
  label: string
  header?: DisplayThemeHeader
  /** Estilos por zona. Vacío cuando el tema usa la base oscura: no pisa nada. */
  styles: DisplayThemeStyles
  /** Estilos de los tickets. Sin definir cuando el tema usa los colores de siempre. */
  tickets?: DisplayTicketStyles
}

function buildStyles(surface?: DisplayThemeSurface): DisplayThemeStyles {
  if (!surface) return {}
  return {
    page: { background: surface.pageBackground, color: surface.text },
    panel: { background: surface.panelBackground, borderColor: surface.panelBorder },
    card: {
      background: surface.cardBackground,
      borderColor: surface.cardBorder,
      ...(surface.cardShadow ? { boxShadow: `0 24px 60px ${surface.cardShadow}` } : {}),
    },
    cardInner: { background: "transparent", borderColor: surface.cardBorder },
    text: { color: surface.text },
    mutedText: { color: surface.mutedText },
    button: {
      background: surface.buttonBackground,
      borderColor: surface.buttonBorder,
      color: surface.text,
      "--tw-ring-color": surface.mutedText,
    } as CSSProperties,
  }
}

/**
 * El aro y la sombra de Tailwind se combinan en una sola propiedad box-shadow.
 * Por eso acá se cambian sus variables y no `boxShadow`: así el aro que aparece
 * al llamar un turno se sigue viendo.
 */
function ringAndShadow(ringColor: string, shadow: string): CSSProperties {
  return { "--tw-ring-color": ringColor, "--tw-shadow": shadow } as CSSProperties
}

function buildTicketCard(palette: DisplayTicketPalette, highlightRgb: string): DisplayTicketCardStyles {
  return {
    frame: {
      background: palette.frame,
      ...ringAndShadow(`rgba(${highlightRgb}, 0.85)`, `0 18px 40px ${palette.glow}`),
    },
    glow: { background: palette.glow },
    body: {
      background: palette.background,
      color: palette.text,
      boxShadow: `0 14px 30px ${palette.glow}`,
    },
    badge: {
      background: palette.badgeBackground,
      color: palette.badgeText,
      boxShadow: `0 10px 22px ${palette.glow}`,
    },
    number: { color: palette.text, filter: `drop-shadow(0 6px 18px ${palette.glow})` },
    service: { color: palette.text, opacity: 0.9 },
    puestoLabel: { color: palette.text, opacity: 0.8 },
    puestoValue: {
      background: palette.chipBackground,
      borderColor: palette.chipBorder,
      color: palette.text,
      boxShadow: `0 10px 22px ${palette.glow}`,
    },
  }
}

function buildTicketStyles(tickets?: DisplayThemeTickets): DisplayTicketStyles | undefined {
  if (!tickets) return undefined
  const rgb = tickets.highlightRgb
  return {
    container: {
      background: tickets.containerBackground,
      borderColor: tickets.containerBorder,
      color: tickets.text,
      "--tw-ring-color": `rgba(${rgb}, 0.6)`,
      ...(tickets.containerShadow ? { "--tw-shadow": `0 24px 60px ${tickets.containerShadow}` } : {}),
    } as CSSProperties,
    pulse: {
      background: `linear-gradient(to bottom right, rgba(${rgb}, 0.15), rgba(${rgb}, 0.08), rgba(${rgb}, 0.15))`,
    },
    wave: { borderColor: `rgba(${rgb}, 0.45)` },
    calledLabel: { color: tickets.calledLabel },
    attendedLabel: { color: tickets.attendedLabel },
    empty: {
      background: "rgba(255, 255, 255, 0.05)",
      borderColor: tickets.containerBorder,
      color: tickets.mutedText,
    },
    emptyText: { color: tickets.text },
    hero: buildTicketCard(tickets.hero, rgb),
    called: buildTicketCard(tickets.called, rgb),
    attended: buildTicketCard(tickets.attended, rgb),
  }
}

/** Devuelve el tema para un valor de `signageTheme`. Nunca falla: lo desconocido cae en "marca". */
export function resolveDisplayTheme(value: string | null | undefined): ResolvedDisplayTheme {
  const requested = String(value ?? "").trim().toLowerCase()
  const id = Object.prototype.hasOwnProperty.call(DISPLAY_THEMES, requested)
    ? requested
    : FALLBACK_DISPLAY_THEME_ID
  const definition = DISPLAY_THEMES[id]
  return {
    id,
    label: definition.label,
    header: definition.header,
    styles: buildStyles(definition.surface),
    tickets: buildTicketStyles(definition.tickets),
  }
}

/** Lista para armar el selector de temas en Administración. */
export const DISPLAY_THEME_OPTIONS = Object.entries(DISPLAY_THEMES).map(([id, definition]) => ({
  id,
  label: definition.label,
}))
