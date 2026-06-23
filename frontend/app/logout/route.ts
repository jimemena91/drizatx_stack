import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const url = new URL(request.url)

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://martinez.app.drizatx.com"

  const response = NextResponse.redirect(
    new URL("/login", baseUrl)
  )

  const cookieOptions = {
    path: "/",
    maxAge: 0,
    sameSite: "lax" as const,
    secure: true,
    httpOnly: true,
    domain: ".drizatx.com",
  }

  response.cookies.set("drizatx-auth", "", cookieOptions)
  response.cookies.set("drizatx-role", "", cookieOptions)
  response.cookies.set("drizatx-token", "", cookieOptions)

  return response
}
