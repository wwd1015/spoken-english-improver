// Vercel Edge Function — production replacement for the Vite dev proxy.
// Forwards Messages API requests to Anthropic with the API key injected
// server-side (the key never reaches the browser).
//
// Env vars to set in Vercel (Project → Settings → Environment Variables):
//   ANTHROPIC_API_KEY  (required)
//   APP_TOKEN          (recommended) — a passcode of your choosing. The app
//                      prompts for it once on the phone and remembers it, so
//                      strangers who find your URL can't spend your API credits.

export const config = { runtime: "edge" };

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json(405, { type: "error", error: { type: "method_not_allowed", message: "POST only" } });
  }

  const appToken = process.env.APP_TOKEN;
  if (appToken && req.headers.get("x-app-token") !== appToken) {
    return json(401, {
      type: "error",
      error: { type: "app_auth", message: "Access code required" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(500, {
      type: "error",
      error: { type: "config", message: "ANTHROPIC_API_KEY is not set on the server" },
    });
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: await req.text(),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": "application/json" },
  });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
