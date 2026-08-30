import { signSession } from "./_auth.js";

const attempts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;
  const record = attempts.get(ip);
  if (!record || record.resetTime < now) {
    attempts.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= maxAttempts) return false;
  record.count++;
  return true;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return json({}, 204);
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const APP_USERNAME = process.env.APP_USERNAME;
  const APP_PASSWORD = process.env.APP_PASSWORD;
  if (!APP_USERNAME || !APP_PASSWORD || !process.env.APP_SESSION_SECRET) {
    return json({ error: "Server misconfigured" }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { username, password } = body || {};
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (!checkRateLimit(clientIP)) {
    return json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, 429);
  }

  if (username === APP_USERNAME && password === APP_PASSWORD) {
    const fingerprint = req.headers.get("user-agent") || "unknown";
    return json({ token: signSession(fingerprint) }, 200);
  }

  await new Promise((r) => setTimeout(r, 400));
  return json({ error: "Identifiants incorrects" }, 401);
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}