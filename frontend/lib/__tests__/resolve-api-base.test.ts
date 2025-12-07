import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { resolveApiBaseUrl, resolveApiBaseWithApiPath } from "@/lib/resolve-api-base"

const ORIGINAL_ENV = { ...process.env }

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key]
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value
  }
}

describe("resolveApiBaseUrl", () => {
  beforeEach(() => {
    resetEnv()
    // Asegura que la caché de módulo no mantenga window entre tests
    delete (globalThis as any).window
  })

  afterEach(() => {
    resetEnv()
    delete (globalThis as any).window
  })

  it("normaliza la URL absoluta recibida", () => {
    expect(resolveApiBaseUrl("https://example.com/api/"))
      .toBe("https://example.com/api")
  })

  it("prioriza NEXT_PUBLIC_API_URL cuando está disponible", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://backend.driza.com"
    expect(resolveApiBaseUrl()).toBe("https://backend.driza.com")
  })

  it("usa window.location.origin como fallback en navegador", () => {
    ;(globalThis as any).window = { location: { origin: "https://app.driza.local" } }
    expect(resolveApiBaseUrl()).toBe("https://app.driza.local")
  })

  it("aplica /api cuando se usa resolveApiBaseWithApiPath", () => {
    process.env.NEXT_PUBLIC_API_URL = "https://backend.driza.com"
    expect(resolveApiBaseWithApiPath()).toBe("https://backend.driza.com/api")
  })

  it("cae en http://localhost:puerto cuando no hay datos", () => {
    process.env.NEXT_PUBLIC_API_PORT = "4100"
    expect(resolveApiBaseUrl()).toBe("http://localhost:4100")
  })
})
