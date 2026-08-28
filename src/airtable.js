const BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;
const TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN;
const API = `https://api.airtable.com/v0/${BASE_ID}`;

async function req(path, options = {}) {
  const res = await fetch(`${API}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable ${res.status}: ${err}`);
  }
  return res.json();
}

export const list = (table, params = "") =>
  req(`${encodeURIComponent(table)}?${params}`).then((d) => d.records);

export const create = (table, fields) =>
  req(`${encodeURIComponent(table)}`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });

export const update = (table, id, fields) =>
  req(`${encodeURIComponent(table)}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });

export const get = (table, id) => req(`${encodeURIComponent(table)}/${id}`);