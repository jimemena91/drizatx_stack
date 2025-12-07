// app/api/tickets/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'

const API = process.env.NEXT_PUBLIC_API_URL // ej: https://drizatx-main-production.up.railway.app

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!API) {
      return NextResponse.json(
        { error: 'Falta NEXT_PUBLIC_API_URL en las variables de entorno' },
        { status: 500 }
      )
    }

    const id = Number(params.id)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    // Leemos el body del frontend
    const body = await request.json() as {
      status?: string
      operator_id?: number
    }

    // Normalizamos el estado a MAYÚSCULAS si viene en minúsculas
    if (body.status) {
      body.status = body.status.toUpperCase() as any // WAITING | CALLED | IN_PROGRESS | COMPLETED | CANCELLED
    }

    // Reenviamos al backend NestJS
    const resp = await fetch(`${API}/api/tickets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // Si más adelante agregás auth JWT, también tendrás que pasar el Authorization aquí.
      body: JSON.stringify(body),
      // Importante en Vercel para evitar cachear mutaciones
      cache: 'no-store',
    })

    const data = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      return NextResponse.json(
        { error: data?.message || 'Error al actualizar el ticket' },
        { status: resp.status }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error updating ticket:', err)
    return NextResponse.json(
      { error: 'Fallo interno al actualizar ticket' },
      { status: 500 }
    )
  }
}

