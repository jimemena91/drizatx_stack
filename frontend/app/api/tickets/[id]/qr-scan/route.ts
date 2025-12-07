import { NextRequest, NextResponse } from "next/server"

const API = process.env.NEXT_PUBLIC_API_URL
const IS_API_MODE = process.env.NEXT_PUBLIC_API_MODE === "true"

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    if (!IS_API_MODE || !API) {
      return NextResponse.json(
        {
          id,
          qrScannedAt: new Date().toISOString(),
        },
        { status: 200 },
      )
    }

    const response = await fetch(`${API}/api/tickets/${id}/qr-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message = typeof data?.error === "string" ? data.error : "No se pudo registrar el escaneo"
      return NextResponse.json({ error: message }, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error registering QR scan", error)
    return NextResponse.json(
      { error: "Fallo interno al registrar el escaneo" },
      { status: 500 },
    )
  }
}
