interface LogoProps {
  size?: "sm" | "md" | "lg"
  variant?: "light" | "dark" | "gradient"
  showText?: boolean
}

export function Logo({ size = "md", variant = "gradient", showText = true }: LogoProps) {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-12 h-12 text-xl",
  }

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  }

  const variantClasses = {
    light: "bg-white text-blue-600",
    dark: "bg-gray-800 text-white",
    gradient: "bg-gradient-to-r from-blue-600 to-purple-600 text-white",
  }

  const textColorClasses = {
    light: "text-gray-800",
    dark: "text-white",
    gradient: "text-gray-800",
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-lg flex items-center justify-center font-bold`}
      >
        DT
      </div>
      {showText && <span className={`${textSizeClasses[size]} font-bold ${textColorClasses[variant]}`}>DrizaTx</span>}
    </div>
  )
}
