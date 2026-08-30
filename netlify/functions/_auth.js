import crypto from "node:crypto";

const SECRET = process.env.APP_SESSION_SECRET;
const SESSION_HOURS = 12;

export function signSession(fingerprint = "") {
  if (!SECRET) throw new Error("APP_SESSION_SECRET is not configured");
  const payload = Buffer.from(
    JSON.stringify({ 
      exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000,
      fp: fingerprint 
    })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token, fingerprint = "") {
  if (!SECRET || !token || typeof token !== "string" || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return false;
    return data.fp === fingerprint;
  } catch {
    return false;
  }
}