// frontend/app/api/services/[id]/operators/route.ts
import { NextRequest, NextResponse } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL!;
if (!API) {
  throw new Error("Falta NEXT_PUBLIC_API_URL (URL del backend en Railway)");
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const res = await fetch(`${API}/api/services/${id}/operators`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: (data as any)?.message || "Error al obtener los operadores del servicio" },
        { status: res.status },
      );
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET /services/:id/operators error", err);
    return NextResponse.json({ error: "Fallo cargando operadores del servicio" }, { status: 500 });
  }
}
