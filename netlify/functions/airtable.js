import { verifySession } from "./_auth.js";

const ALLOWED_TABLES = new Set(["Clients", "Véhicules", "Abonnements", "Lavages", "QR Codes"]);

const ALLOWED_FIELDS = {
  "Clients": ["Nom", "Téléphone", "Email"],
  "Véhicules": ["Matriculation", "Marque", "Modèle", "Client"],
  "Abonnements": ["Client", "Véhicule", "QR Code", "Forfait", "Date début", "Date fin", "Nombre lavages", "Lavages utilisés"],
  "Lavages": ["Abonnement", "Client", "Véhicule", "Date/heure"],
  "QR Codes": ["Code", "Status", "Abonnement"],
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return json({}, 204);
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const fingerprint = req.headers.get("user-agent") || "unknown";
  
  if (!verifySession(token, fingerprint)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return json({ error: "Server misconfigured: missing Airtable credentials" }, 500);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { table, id, method = "GET", fields, params } = payload || {};

  if (!table || !ALLOWED_TABLES.has(table)) {
    return json({ error: "Unknown or missing table" }, 400);
  }
  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
    return json({ error: "Unknown method" }, 400);
  }

  if (fields && ALLOWED_FIELDS[table]) {
    for (const key of Object.keys(fields)) {
      if (!ALLOWED_FIELDS[table].includes(key)) {
        return json({ error: `Field not allowed: ${key}` }, 400);
      }
    }
  }
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  console.log(`[${new Date().toISOString()}] ${method} ${table}${id ? '/' + id : ''} by ${clientIP}`);

  let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`;
  if (id) url += `/${encodeURIComponent(id)}`;
  if (params) url += `?${params}`;

  const fetchOpts = {
    method,
    headers: {
      Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      "Content-Type": "application/json",
    },
  };
  if (fields !== undefined && (method === "POST" || method === "PATCH")) {
    fetchOpts.body = JSON.stringify({ fields });
  }

  try {
    const airtableRes = await fetch(url, fetchOpts);
    const data = await airtableRes.json();
    return json(data, airtableRes.status);
  } catch (e) {
    return json({ error: "Upstream request failed", detail: String(e) }, 502);
  }
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