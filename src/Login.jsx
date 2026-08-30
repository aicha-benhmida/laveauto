import { useState } from "react";
import { setToken } from "./airtable";

export default function Login({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/.netlify/functions/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setErr(data.error || "Identifiants incorrects");
        setLoading(false);
        return;
      }
      setToken(data.token);
      onLogin();
    } catch {
      setErr("Impossible de contacter le serveur. Réessayez.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <form onSubmit={submit} style={{ background: "white", padding: 24, borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", width: 300 }}>
        <h2 style={{ marginBottom: 16 }}>LaveAuto Login</h2>
        {err && <p style={{ color: "red", fontSize: 14 }}>{err}</p>}
        <input placeholder="Utilisateur" value={u} onChange={(e) => setU(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8, border: "1px solid #ccc", borderRadius: 4, fontSize: 16 }} />
        <input type="password" placeholder="Mot de passe" value={p} onChange={(e) => setP(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12, border: "1px solid #ccc", borderRadius: 4, fontSize: 16 }} />
        <button type="submit" disabled={loading} style={{ width: "100%", padding: 10, background: "black", color: "white", border: "none", borderRadius: 4 }}>
          {loading ? "..." : "Connexion"}
        </button>
      </form>
    </div>
  );
}
