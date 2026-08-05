import Image from "next/image"

type LogoSize = "sm" | "md" | "lg"
type LogoVariant = "light" | "dark"
type LogoDisplay = "full" | "mark"

interface LogoProps {
  size?: LogoSize
  variant?: LogoVariant
  showText?: boolean
  display?: LogoDisplay
  priority?: boolean
  className?: string
}

const fullLogoDimensions: Record<
  LogoSize,
  { width: number; height: number; className: string }
> = {
  sm: {
    width: 136,
    height: 46,
    className: "h-9 w-auto",
  },
  md: {
    width: 170,
    height: 58,
    className: "h-12 w-auto",
  },
  lg: {
    width: 238,
    height: 81,
    className: "h-20 w-auto",
  },
}

const markDimensions: Record<
  LogoSize,
  { width: number; height: number; className: string }
> = {
  sm: {
    width: 32,
    height: 32,
    className: "h-8 w-8",
  },
  md: {
    width: 40,
    height: 40,
    className: "h-10 w-10",
  },
  lg: {
    width: 56,
    height: 56,
    className: "h-14 w-14",
  },
}

export function Logo({
  size = "md",
  variant = "light",
  showText = true,
  display,
  priority = false,
  className = "",
}: LogoProps) {
  const resolvedDisplay: LogoDisplay =
    display ?? (showText ? "full" : "mark")

  if (resolvedDisplay === "mark") {
    const dimensions = markDimensions[size]

    return (
      <Image
        src="/branding/drizatx-marca-128.png"
        alt="DrizaTx"
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className={`${dimensions.className} object-contain ${className}`.trim()}
      />
    )
  }

  const dimensions = fullLogoDimensions[size]
  const source =
    variant === "dark"
      ? "/branding/drizatx-logo-fondo-oscuro.png"
      : "/branding/drizatx-logo-fondo-claro.png"

  return (
    <Image
      src={source}
      alt="DrizaTx — Sistema de gestión de turnos"
      width={dimensions.width}
      height={dimensions.height}
      priority={priority}
      className={`${dimensions.className} object-contain ${className}`.trim()}
    />
  )
}
