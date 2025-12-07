// frontend/app/api/services/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'

// Usamos la URL pública del backend (Railway) que definiste en Vercel
// Ej: https://drizatx-main-production.up.railway.app
const API = process.env.NEXT_PUBLIC_API_URL!
if (!API) {
  // Fail fast en build/runtime si falta la env
  throw new Error('Falta NEXT_PUBLIC_API_URL (URL del backend en Railway)')
}

// PUT /api/services/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 })
    }

    const body = await request.json()

    // Redirigimos la llamada al backend NestJS
    const res = await fetch(`${API}/api/services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // Si necesitás token: headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      body: JSON.stringify(body),
      // Opcional: timeout vía AbortController si querés
      // cache: 'no-store' evitaría cache accidental en Vercel
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message || 'Error al actualizar el servicio' },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('PUT /services/:id error', err)
    return NextResponse.json(
      { error: 'Fallo actualizando el servicio' },
      { status: 500 }
    )
  }
}

// DELETE /api/services/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 })
    }

    const res = await fetch(`${API}/api/services/${id}`, {
      method: 'DELETE',
    })

    // Algunos backends devuelven 204 sin body
    let data: any = null
    try {
      data = await res.json()
    } catch {
      data = null
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.message || 'Error al borrar el servicio' },
        { status: res.status }
      )
    }

    return NextResponse.json(
      data ?? { message: 'Service deleted successfully' }
    )
  } catch (err) {
    console.error('DELETE /services/:id error', err)
    return NextResponse.json(
      { error: 'Fallo eliminando el servicio' },
      { status: 500 }
    )
  }
}
