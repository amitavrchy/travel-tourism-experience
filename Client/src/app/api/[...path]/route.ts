import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const API = process.env.API_URL || "http://127.0.0.1:4000";

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part)))
    return NextResponse.json({ message: "Invalid API path." }, { status: 400 });
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      let valid = false;
      try {
        valid = new URL(origin).host === request.headers.get("host");
      } catch {
        /* Invalid Origin header. */
      }
      if (!valid)
        return NextResponse.json(
          { message: "Invalid request origin." },
          { status: 403 },
        );
    }
  }
  if (path.join("/") === "auth/logout") {
    const response = NextResponse.json({ success: true });
    response.cookies.delete("wl_session");
    return response;
  }
  const token = request.cookies.get("wl_session")?.value;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (
    path.join("/") === "payments/webhook" &&
    request.headers.get("stripe-signature")
  )
    headers["stripe-signature"] = request.headers.get("stripe-signature")!;
  try {
    const body = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.text();
    if (body && body.length > 250000)
      return NextResponse.json(
        { message: "Request is too large." },
        { status: 413 },
      );
    const upstream = await fetch(
      `${API}/${path.join("/")}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(90000)]),
      },
    );
    if (upstream.headers.get("content-type")?.includes("text/event-stream"))
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    const payload = await upstream.json();
    const { token: sessionToken, ...safe } =
      payload && !Array.isArray(payload) ? payload : { token: undefined };
    const response = NextResponse.json(
      Array.isArray(payload) ? payload : safe,
      { status: upstream.status, headers: { "Cache-Control": "no-store" } },
    );
    if (sessionToken)
      response.cookies.set("wl_session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 86400,
        path: "/",
      });
    if (upstream.status === 401) response.cookies.delete("wl_session");
    return response;
  } catch {
    return NextResponse.json(
      {
        message:
          "We couldn’t reach the travel service. Please try again shortly.",
      },
      { status: 503 },
    );
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
