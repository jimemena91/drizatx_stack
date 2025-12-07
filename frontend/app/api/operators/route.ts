// frontend/app/api/operators/route.ts
import { NextRequest, NextResponse } from "next/server"

const API = process.env.NEXT_PUBLIC_API_URL // ej: https://drizatx-main-production.up.railway.app

if (!API) {
  // Evitamos fallar en build sin variables
  throw new Error("Falta NEXT_PUBLIC_API_URL en el entorno del frontend")
}

// GET /api/operators  -> proxy a tu backend Nest
export async function GET(req: NextRequest) {
  try {
    const r = await fetch(`${API}/api/operators`, {
      cache: "no-store",
      headers: {
        ...(req.headers.get("authorization") ? { Authorization: req.headers.get("authorization")! } : {}),
        ...(req.headers.get("cookie") ? { Cookie: req.headers.get("cookie")! } : {}),
      },
    })
    const body = await r.text()
    return new NextResponse(body, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
    })
  } catch (err) {
    console.error("Proxy GET /operators error:", err)
    return NextResponse.json({ error: "Fallo al consultar operadores" }, { status: 502 })
  }
}

// POST /api/operators  -> proxy a tu backend Nest
export async function POST(req: NextRequest) {
  try {
    // Notas:
    // - No hasheamos aquí: que lo haga el backend (buena práctica).
    // - Simplemente reenviamos el JSON al backend.
    const payload = await req.text()

    const r = await fetch(`${API}/api/operators`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.get("authorization") ? { Authorization: req.headers.get("authorization")! } : {}),
        ...(req.headers.get("cookie") ? { Cookie: req.headers.get("cookie")! } : {}),
      },
      body: payload,
    })

    const body = await r.text()
    return new NextResponse(body, {
      status: r.status,
      headers: { "Content-Type": r.headers.get("content-type") || "application/json" },
    })
  } catch (err) {
    console.error("Proxy POST /operators error:", err)
    return NextResponse.json({ error: "Fallo al crear operador" }, { status: 502 })
  }
}
