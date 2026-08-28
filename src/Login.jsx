import { useState } from "react";

const USER = import.meta.env.VITE_APP_USERNAME;
const PASS = import.meta.env.VITE_APP_PASSWORD;

export default function Login({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (u === USER && p === PASS) {
      sessionStorage.setItem("laveauto_auth", "1");
      onLogin();
    } else {
      setErr("Identifiants incorrects");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb" }}>
      <form onSubmit={submit} style={{ background: "white", padding: 24, borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", width: 300 }}>
        <h2 style={{ marginBottom: 16 }}>LaveAuto Login</h2>
        {err && <p style={{ color: "red", fontSize: 14 }}>{err}</p>}
        <input placeholder="Utilisateur" value={u} onChange={(e) => setU(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8, border: "1px solid #ccc", borderRadius: 4 }} />
        <input type="password" placeholder="Mot de passe" value={p} onChange={(e) => setP(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12, border: "1px solid #ccc", borderRadius: 4 }} />
        <button type="submit" style={{ width: "100%", padding: 10, background: "black", color: "white", border: "none", borderRadius: 4 }}>
          Connexion
        </button>
      </form>
    </div>
  );
}
