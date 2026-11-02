// DuaLock waitlist: a Cloudflare Worker at https://api.dualock.app/waitlist.
// The coming-soon page POSTs { email, source } here and it lands in the D1
// database "dualock-waitlist" (EU jurisdiction). Plain JS, no build step.

const ALLOWED_ORIGINS = ["https://dualock.app", "https://www.dualock.app"];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/waitlist") return new Response("Not found", { status: 404 });

    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin);
    const cors = corsHeaders(allowed ? origin : null);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
    if (!allowed) return json({ error: "forbidden" }, 403, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "bad_request" }, 400, cors);
    }

    // Honeypot: people never see this field, bots fill it in. Pretend it worked.
    if (body.company) return json({ ok: true }, 200, cors);

    const email = String(body.email || "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) {
      return json({ error: "invalid_email" }, 400, cors);
    }
    const source = String(body.source || "").slice(0, 100) || null;
    const country = request.cf?.country || null;

    // Joining twice is fine: the first sign-up is kept.
    await env.DB.prepare(
      "INSERT INTO waitlist (email, source, country, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(email) DO NOTHING"
    )
      .bind(email, source, country, new Date().toISOString())
      .run();

    return json({ ok: true }, 200, cors);
  },
};
