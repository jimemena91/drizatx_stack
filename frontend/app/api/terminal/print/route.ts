import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const BACKEND_URL = process.env.BACKEND_URL;
    if (!BACKEND_URL) {
      return NextResponse.json(
        { success: false, error: "BACKEND_URL no está configurado en el frontend" },
        { status: 500 }
      );
    }

    const upstream = `${BACKEND_URL}/api/terminal/print`;

    // Pasamos el bearer si vino (aunque sea vacío)
    const auth = req.headers.get("authorization") ?? "";

    const resp = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: auth } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await resp.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    return NextResponse.json(
      data ?? { success: resp.ok },
      { status: resp.status }
    );
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Error inesperado en /api/terminal/print" },
      { status: 500 }
    );
  }
}
