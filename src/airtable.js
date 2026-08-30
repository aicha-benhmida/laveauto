const FUNCTION_URL = "/.netlify/functions/airtable";
const TOKEN_KEY = "laveauto_token";

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function req(body, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt < retries - 1) {
      const delay = Math.pow(2, attempt) * 1000; 
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (res.status === 401) {
      clearToken();
      window.location.reload();
      throw new Error("Session expirée. Merci de vous reconnecter.");
    }

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      throw new Error(`Airtable ${res.status}: ${data ? JSON.stringify(data) : "request failed"}`);
    }
    return data;
  }
}

export async function list(table, extraParams = "") {
  let all = [];
  let offset;
  do {
    const parts = [];
    if (extraParams) parts.push(extraParams);
    parts.push("pageSize=100");
    if (offset) parts.push(`offset=${encodeURIComponent(offset)}`);
    const data = await req({ table, method: "GET", params: parts.join("&") });
    all = all.concat(data.records || []);
    offset = data.offset;
  } while (offset);
  return all;
}

export const create = (table, fields) => req({ table, method: "POST", fields });
export const update = (table, id, fields) => req({ table, id, method: "PATCH", fields });
export const get = (table, id) => req({ table, id, method: "GET" });
export const remove = (table, id) => req({ table, id, method: "DELETE" });