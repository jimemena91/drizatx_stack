const ARG_COUNTRY_CODE = "54"
const ARG_MOBILE_PREFIX = "9"
const LOCAL_MOBILE_MARKER = "15"
export const MIN_PHONE_DIGITS = 12

export function stripToDigits(value: string): string {
  return value.replace(/\D/g, "")
}

export function normalizeArgentinaPhoneNumber(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) {
    return ""
  }

  let digits = stripToDigits(trimmed)
  if (!digits) {
    return ""
  }

  // Quitar prefijos internacionales (00) y ceros iniciales redundantes
  digits = digits.replace(/^00+/, "")
  digits = digits.replace(/^0+/, "")

  if (digits.startsWith(ARG_COUNTRY_CODE)) {
    digits = digits.slice(ARG_COUNTRY_CODE.length)
  }

  digits = digits.replace(/^0+/, "")

  // Si ya tiene el prefijo móvil "9", asumimos que está correcto.
  let nationalNumber = digits
  if (!nationalNumber) {
    return ""
  }

  if (!nationalNumber.startsWith(ARG_MOBILE_PREFIX)) {
    // Remover el "15" local después del código de área (2 a 4 dígitos)
    for (let areaLength = 2; areaLength <= 4; areaLength++) {
      if (nationalNumber.length > areaLength + 1) {
        const slice = nationalNumber.slice(areaLength, areaLength + 2)
        if (slice === LOCAL_MOBILE_MARKER) {
          nationalNumber = nationalNumber.slice(0, areaLength) + nationalNumber.slice(areaLength + 2)
          break
        }
      }
    }

    if (!nationalNumber.startsWith(ARG_MOBILE_PREFIX)) {
      nationalNumber = `${ARG_MOBILE_PREFIX}${nationalNumber}`
    }
  }

  const normalizedDigits = `${ARG_COUNTRY_CODE}${nationalNumber}`
  return `+${normalizedDigits}`
}

export function hasValidPhoneLength(input: string): boolean {
  const normalized = normalizeArgentinaPhoneNumber(input)
  const digits = stripToDigits(normalized)
  return digits.length >= MIN_PHONE_DIGITS
}

export function ensureSmsPhoneNumber(phone?: string | null): string | null {
  if (!phone) {
    return null
  }

  const normalized = normalizeArgentinaPhoneNumber(phone)
  if (!normalized) {
    return null
  }

  return hasValidPhoneLength(normalized) ? normalized : null
}
