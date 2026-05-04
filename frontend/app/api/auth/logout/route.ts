import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  const cookiesToClear = [
    "drizatx-auth",
    "drizatx-role",
    "drizatx-auth-token",
    "token",
    "access_token",
  ];

  const domains = [undefined, ".drizatx.com"];

  for (const name of cookiesToClear) {
    for (const domain of domains) {
      response.cookies.set({
        name,
        value: "",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        httpOnly: false,
        sameSite: "lax",
        ...(domain ? { domain } : {}),
      });
    }
  }

  return response;
}
