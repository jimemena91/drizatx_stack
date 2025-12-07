import type { SystemSetting } from "./types"

export function getBooleanSetting(
  settings: SystemSetting[] | undefined,
  key: string,
  defaultValue = false,
): boolean {
  if (!Array.isArray(settings)) return defaultValue

  const setting = settings.find((item) => item.key === key)
  if (!setting) return defaultValue

  const rawValue = setting.value
  if (typeof rawValue === "boolean") return rawValue

  const normalized = String(rawValue ?? "")
    .trim()
    .toLowerCase()

  if (["true", "1", "yes", "on", "si", "sí"].includes(normalized)) return true
  if (["false", "0", "no", "off"].includes(normalized)) return false

  return defaultValue
}

export function getSettingValue(
  settings: SystemSetting[] | undefined,
  key: string,
  defaultValue = "",
): string {
  if (!Array.isArray(settings)) return defaultValue

  const setting = settings.find((item) => item.key === key)
  if (!setting || setting.value === undefined || setting.value === null) {
    return defaultValue
  }

  return String(setting.value)
}
