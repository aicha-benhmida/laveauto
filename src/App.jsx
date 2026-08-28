import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import * as at from "./airtable";
import Login from "./Login";

const FORFAITS = { "5 Lavages": 5, "10 Lavages": 10, "20 Lavages": 20 };

// Barcode fields come back from Airtable as { text: "CW-0002", type: "..." }
// instead of a plain string — this normalizes either shape to a string.
const codeText = (val) => (val && typeof val === "object" ? val.text || "" : val || "");

const friendlyError = (raw) => {
  if (raw.includes("INVALID_VALUE_FOR_COLUMN")) return "Vérifiez que tous les champs sont bien remplis.";
  if (raw.includes("401") || raw.includes("403")) return "Problème d'accès à la base de données.";
  if (raw.includes("404")) return "Élément introuvable.";
  return "Une erreur est survenue. Réessayez.";
};

export default function App() {
  const [authed, setAuthed] = useState(sessionStorage.getItem("laveauto_auth") === "1");
  const [tab, setTab] = useState("qr");
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px 0" }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#e5e7eb", padding: 4, borderRadius: 10 }}>
          <TabButton active={tab === "qr"} onClick={() => setTab("qr")}>QR Code</TabButton>
          <TabButton active={tab === "client"} onClick={() => setTab("client")}>Client</TabButton>
          <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>Tableau de bord</TabButton>
        </div>
      </div>
      {tab === "qr" ? <QRSearchApp /> : tab === "client" ? <ClientHistory /> : <Dashboard />}
    </div>
  );
}

const TabButton = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    flex: 1, padding: "8px 12px", borderRadius: 7, border: "none", cursor: "pointer",
    background: active ? "white" : "transparent", color: active ? "#111827" : "#6b7280",
    fontWeight: active ? 600 : 500, fontSize: 14, boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
  }}>
    {children}
  </button>
);

function Dashboard() {
  const [abonnements, setAbonnements] = useState([]);
  const [lavages, setLavages] = useState([]);
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(() => {
    const saved = localStorage.getItem("laveauto_threshold");
    return saved ? Number(saved) : 10;
  });
  const [prices, setPrices] = useState(() => {
    try {
      const saved = localStorage.getItem("laveauto_prices");
      return saved ? JSON.parse(saved) : { "5 Lavages": 30, "10 Lavages": 55, "20 Lavages": 100 };
    } catch {
      return { "5 Lavages": 30, "10 Lavages": 55, "20 Lavages": 100 };
    }
  });

  useEffect(() => {
    (async () => {
      const [ab, la, qr] = await Promise.all([at.list("Abonnements"), at.list("Lavages"), at.list("QR Codes")]);
      setAbonnements(ab); setLavages(la); setQrCodes(qr);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem("laveauto_prices", JSON.stringify(prices));
  }, [prices]);

  useEffect(() => {
    localStorage.setItem("laveauto_threshold", String(threshold));
  }, [threshold]);

  if (loading) return <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 24px", color: "#6b7280" }}>Chargement...</div>;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 6);

  const washDate = (l) => (l.fields["Date/heure"] ? new Date(l.fields["Date/heure"]) : null);
  const todayCount = lavages.filter((l) => { const d = washDate(l); return d && d >= startOfToday; }).length;
  const weekCount = lavages.filter((l) => { const d = washDate(l); return d && d >= startOfWeek; }).length;

  const validCount = abonnements.filter((a) => a.fields["Statut"] === "VALIDE").length;
  const expiredCount = abonnements.filter((a) => a.fields["Statut"] === "EXPIRÉ" || a.fields["Statut"] === "TERMINÉ").length;

  const abonnementsThisWeek = abonnements.filter((a) => {
    const d = a.fields["Date début"] ? new Date(a.fields["Date début"]) : null;
    return d && d >= startOfWeek;
  });
  const revenueEstimate = abonnementsThisWeek.reduce((sum, a) => sum + (prices[a.fields["Forfait"]] || 0), 0);

  const statusText = (val) => {
    const raw = val && typeof val === "object" ? val.name || "" : val || "";
    return raw.trim().toUpperCase();
  };
  const byStatusLabel = qrCodes.filter((q) => statusText(q.fields["Status"]) === "DISPONIBLE").length;
  const byNoLink = qrCodes.filter((q) => !q.fields["Abonnement"] || q.fields["Abonnement"].length === 0).length;
  // Trust the Status label when it actually has DISPONIBLE codes; otherwise
  // fall back to "no linked abonnement" so a mismatched select option name
  // doesn't silently show 0.
  const availableQR = byStatusLabel > 0 ? byStatusLabel : byNoLink;
  const lowStock = availableQR < threshold;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 24px" }}>
      {lowStock && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", padding: "12px 16px", borderRadius: 10, marginBottom: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <span>⚠️</span>
          <span>Il ne reste que <strong>{availableQR}</strong> QR codes disponibles (seuil: {threshold}). Pensez à en réimprimer.</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <StatCard label="Lavages aujourd'hui" value={todayCount} color="#111827" />
        <StatCard label="Lavages (7 jours)" value={weekCount} color="#111827" />
        <StatCard label="Abonnements actifs" value={validCount} color="#16a34a" />
        <StatCard label="Abonnements expirés" value={expiredCount} color="#dc2626" />
        <StatCard label="QR codes disponibles" value={availableQR} color={lowStock ? "#dc2626" : "#111827"} />
        <StatCard label="QR codes total" value={qrCodes.length} color="#111827" />
      </div>

      <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span style={{ fontSize: 14, color: "#6b7280" }}>Revenu estimé (7 derniers jours)</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{revenueEstimate} TND</span>
        </div>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>Basé sur {abonnementsThisWeek.length} nouveaux abonnements et les prix ci-dessous</div>
      </div>

      <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 10 }}>Seuil d'alerte QR codes</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: "#374151" }}>Alerter en dessous de</span>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            style={{ width: 70, padding: 6, border: "1px solid #ddd", borderRadius: 6, textAlign: "right", color: "#111827" }}
          />
          <span style={{ fontSize: 14, color: "#374151" }}>codes restants</span>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 10 }}>Prix par forfait (pour l'estimation)</div>
        {Object.keys(FORFAITS).map((f) => (
          <div key={f} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: "#374151" }}>{f}</span>
            <input
              type="number"
              value={prices[f]}
              onChange={(e) => setPrices({ ...prices, [f]: Number(e.target.value) })}
              style={{ width: 90, padding: 6, border: "1px solid #ddd", borderRadius: 6, textAlign: "right", color: "#111827" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const StatCard = ({ label, value, color }) => (
  <div style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
    <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
  </div>
);

function ClientHistory() {
  const [query, setQuery] = useState("");
  const [clients, setClients] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [abonnements, setAbonnements] = useState([]);
  const [lavages, setLavages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [cl, ve, ab, la] = await Promise.all([
        at.list("Clients"), at.list("Véhicules"), at.list("Abonnements"), at.list("Lavages"),
      ]);
      setClients(cl); setVehicules(ve); setAbonnements(ab); setLavages(la);
      setLoading(false);
    })();
  }, []);

  const matches = query.length >= 2
    ? clients.filter((c) =>
        (c.fields["Nom"] || "").toLowerCase().includes(query.toLowerCase()) ||
        (c.fields["Téléphone"] || "").toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const clientVehicules = selected ? vehicules.filter((v) => v.fields["Client"]?.includes(selected.id)) : [];
  const clientAbonnements = selected ? abonnements.filter((a) => a.fields["Client"]?.includes(selected.id)) : [];
  const clientAbonnementIds = clientAbonnements.map((a) => a.id);
  const clientLavages = selected
    ? lavages
        .filter((l) => l.fields["Client"]?.includes(selected.id) || l.fields["Abonnement"]?.some((id) => clientAbonnementIds.includes(id)))
        .sort((a, b) => new Date(b.fields["Date/heure"] || 0) - new Date(a.fields["Date/heure"] || 0))
    : [];

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 24px" }}>
      <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          placeholder="Rechercher par nom ou téléphone..."
          style={{ width: "100%", padding: 11, border: "1px solid #d1d5db", borderRadius: 8, fontSize: 15, color: "#111827", outline: "none" }}
        />
      </div>

      {loading && <p style={{ color: "#6b7280" }}>Chargement...</p>}

      {!selected && matches.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          {matches.map((c) => (
            <button key={c.id} onClick={() => setSelected(c)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: 14, background: "white", border: "none", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}>
              <div style={{ fontWeight: 600, color: "#111827" }}>{c.fields["Nom"]}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{c.fields["Téléphone"] || "-"}</div>
            </button>
          ))}
        </div>
      )}

      {!selected && query.length >= 2 && matches.length === 0 && !loading && (
        <div style={{ background: "white", borderRadius: 12, padding: 24, textAlign: "center", color: "#6b7280" }}>
          Aucun client trouvé pour "{query}"
        </div>
      )}

      {selected && (
        <div>
          <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", marginBottom: 12, fontSize: 14, padding: 0 }}>
            ← Retour aux résultats
          </button>

          <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 16, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{selected.fields["Nom"]}</h2>
            <div style={{ color: "#6b7280", fontSize: 14 }}>{selected.fields["Téléphone"] || "-"}</div>
            {selected.fields["Email"] && <div style={{ color: "#6b7280", fontSize: 14 }}>{selected.fields["Email"]}</div>}

            {clientVehicules.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Véhicule(s)</div>
                {clientVehicules.map((v) => (
                  <div key={v.id} style={{ fontSize: 14, color: "#111827" }}>
                    {v.fields["Matriculation"]} {v.fields["Marque"] ? `· ${v.fields["Marque"]} ${v.fields["Modèle"] || ""}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 8 }}>Abonnements ({clientAbonnements.length})</h3>
          {clientAbonnements.length === 0 && <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 16 }}>Aucun abonnement.</p>}
          {clientAbonnements.map((a) => {
            const s = a.fields["Statut"];
            return (
              <div key={a.id} style={{ background: "white", borderRadius: 10, padding: 14, marginBottom: 8, border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: "#111827" }}>{a.fields["Forfait"]}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: s === "VALIDE" ? "#16a34a" : "#dc2626" }}>{s}</span>
                </div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>
                  {a.fields["Date début"]} → {a.fields["Date fin"]} · {a.fields["Lavages restants"]} lavages restants
                </div>
              </div>
            );
          })}

          <h3 style={{ fontSize: 15, fontWeight: 600, color: "#111827", margin: "16px 0 8px" }}>Historique des lavages ({clientLavages.length})</h3>
          {clientLavages.length === 0 && <p style={{ color: "#6b7280", fontSize: 14 }}>Aucun lavage enregistré.</p>}
          {clientLavages.map((l) => (
            <div key={l.id} style={{ background: "white", borderRadius: 10, padding: "10px 14px", marginBottom: 6, border: "1px solid #e5e7eb", fontSize: 14, color: "#111827" }}>
              {l.fields["Date/heure"] ? new Date(l.fields["Date/heure"]).toLocaleString("fr-FR") : "-"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QRSearchApp() {
  const [query, setQuery] = useState("");
  const [qrRecords, setQrRecords] = useState([]);
  const [clients, setClients] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [matchedQR, setMatchedQR] = useState(null);
  const [abonnement, setAbonnement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [lastLavage, setLastLavage] = useState(null); // { id, abonnementId }
  const scannerRef = useRef(null);

  const [newA, setNewA] = useState({
    clientId: "", vehiculeId: "", forfait: "5 Lavages",
    dateDebut: new Date().toISOString().split("T")[0], dateFin: "",
    newClientName: "", newClientPhone: "",
    newVehMat: "", newVehMarque: "", newVehModele: "",
    createClient: true, createVeh: true,
  });
  const [editA, setEditA] = useState({ forfait: "5 Lavages", dateDebut: "", dateFin: "" });

  const refresh = async () => {
    const [qr, cl, ve] = await Promise.all([
      at.list("QR Codes"), at.list("Clients"), at.list("Véhicules"),
    ]);
    setQrRecords(qr); setClients(cl); setVehicules(ve);
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (query.length >= 2) {
      const found = qrRecords.find((r) =>
        codeText(r.fields["Code"]).toLowerCase().includes(query.toLowerCase())
      );
      setMatchedQR(found || null);
    } else setMatchedQR(null);
  }, [query, qrRecords]);

  useEffect(() => {
    const loadAbonnement = async () => {
      setLastLavage(null);
      if (!matchedQR?.fields["Abonnement"]?.length) { setAbonnement(null); return; }
      const recs = await at.list("Abonnements");
      const found = recs.find((r) => r.id === matchedQR.fields["Abonnement"][0]);
      setAbonnement(found || null);
      if (found) {
        setEditA({
          forfait: found.fields["Forfait"] || "5 Lavages",
          dateDebut: found.fields["Date début"] || "",
          dateFin: found.fields["Date fin"] || "",
        });
      }
    };
    loadAbonnement();
  }, [matchedQR]);

  const showMsg = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  const startScan = async () => {
    setScanning(true);
    setTimeout(async () => {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (text) => { setQuery(text); stopScan(); },
          () => {}
        );
      } catch (e) {
        setErr("Erreur caméra: " + e.message);
        setScanning(false);
      }
    }, 100);
  };

  const stopScan = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
    }
    setScanning(false);
  };

  const createLavage = async () => {
    setErr(""); setLoading(true);
    try {
      const client = abonnement.fields["Client"]?.[0];
      const veh = abonnement.fields["Véhicule"]?.[0];
      const lavage = await at.create("Lavages", {
        Abonnement: [abonnement.id],
        "Date/heure": new Date().toISOString(),
        ...(client ? { Client: [client] } : {}),
        ...(veh ? { Véhicule: [veh] } : {}),
      });
      const used = (abonnement.fields["Lavages utilisés"] || 0) + 1;
      await at.update("Abonnements", abonnement.id, { "Lavages utilisés": used });
      setLastLavage({ id: lavage.id, abonnementId: abonnement.id });
      showMsg("Lavage créé!");
      await refreshAbonnement();
    } catch (e) { setErr(friendlyError(e.message)); }
    setLoading(false);
  };

  const undoLastLavage = async () => {
    if (!lastLavage) return;
    setErr(""); setLoading(true);
    try {
      await at.remove("Lavages", lastLavage.id);
      const used = Math.max((abonnement.fields["Lavages utilisés"] || 0) - 1, 0);
      await at.update("Abonnements", lastLavage.abonnementId, { "Lavages utilisés": used });
      setLastLavage(null);
      showMsg("Dernier lavage annulé.");
      await refreshAbonnement();
    } catch (e) { setErr(friendlyError(e.message)); }
    setLoading(false);
  };

  const refreshAbonnement = async () => {
    // Airtable's formula fields (Statut) can lag a moment right after a write.
    // Small delay + direct record fetch avoids showing the stale value.
    await new Promise((r) => setTimeout(r, 600));
    const found = await at.get("Abonnements", abonnement.id);
    setAbonnement(found || null);
  };

  const updateAbonnement = async () => {
    setErr("");
    const today = new Date().toISOString().split("T")[0];
    if (!editA.dateDebut || !editA.dateFin) {
      setErr("Merci de renseigner la date début et la date fin.");
      return;
    }
    if (editA.dateFin < today) {
      setErr("La date fin ne peut pas être dans le passé pour un renouvellement.");
      return;
    }
    if (editA.dateFin <= editA.dateDebut) {
      setErr("La date fin doit être après la date début.");
      return;
    }
    setLoading(true);
    try {
      await at.update("Abonnements", abonnement.id, {
        Forfait: editA.forfait,
        "Date début": editA.dateDebut,
        "Date fin": editA.dateFin,
        "Lavages utilisés": 0,
        "Nombre lavages": FORFAITS[editA.forfait],
      });
      setShowEdit(false);
      showMsg("Abonnement renouvelé!");
      await refreshAbonnement();
    } catch (e) { setErr(friendlyError(e.message)); }
    setLoading(false);
  };

  const createAbonnement = async () => {
    setErr("");
    const today = new Date().toISOString().split("T")[0];
    if (!newA.dateDebut || !newA.dateFin) {
      setErr("Merci de renseigner la date début et la date fin.");
      return;
    }
    if (newA.dateFin < today) {
      setErr("La date fin ne peut pas être dans le passé.");
      return;
    }
    if (newA.dateFin <= newA.dateDebut) {
      setErr("La date fin doit être après la date début.");
      return;
    }
    setLoading(true);
    try {
      let clientId = newA.clientId;
      let vehId = newA.vehiculeId;

      if (newA.createClient) {
        const rec = await at.create("Clients", {
          Nom: newA.newClientName, Téléphone: newA.newClientPhone,
        });
        clientId = rec.id;
      }
      if (newA.createVeh) {
        const rec = await at.create("Véhicules", {
          Matriculation: newA.newVehMat, Marque: newA.newVehMarque, Modèle: newA.newVehModele,
          ...(clientId ? { Client: [clientId] } : {}),
        });
        vehId = rec.id;
      }
      await at.create("Abonnements", {
        "QR Code": [matchedQR.id],
        ...(clientId ? { Client: [clientId] } : {}),
        ...(vehId ? { Véhicule: [vehId] } : {}),
        Forfait: newA.forfait,
        "Date début": newA.dateDebut,
        "Date fin": newA.dateFin,
        "Nombre lavages": FORFAITS[newA.forfait],
        "Lavages utilisés": 0,
      });
      await at.update("QR Codes", matchedQR.id, { Status: "ACTIVÉ" });
      setShowNew(false);
      showMsg("Abonnement créé!");
      await refresh();
    } catch (e) { setErr(friendlyError(e.message)); }
    setLoading(false);
  };

  const statut = abonnement?.fields["Statut"];
  const clientInfo = abonnement && clients.find((c) => c.id === abonnement.fields["Client"]?.[0]);
  const vehInfo = abonnement && vehicules.find((v) => v.id === abonnement.fields["Véhicule"]?.[0]);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 24px" }}>
        {msg && <div style={{ background: "#dcfce7", color: "#166534", padding: 10, borderRadius: 6, marginBottom: 12 }}>{msg}</div>}
        {err && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚠️</span> {err}
          </div>
        )}

        <div style={{ background: "white", borderRadius: 12, padding: 20, marginBottom: 20, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un code QR..."
              style={{ flex: 1, padding: 11, border: "1px solid #d1d5db", borderRadius: 8, fontSize: 15, color: "#111827", outline: "none" }} />
            <button onClick={scanning ? stopScan : startScan}
              style={{ padding: "11px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: scanning ? "#ef4444" : "#111827", color: "white", fontWeight: 500, cursor: "pointer" }}>
              {scanning ? "Arrêter" : "Scanner"}
            </button>
          </div>
          {scanning && <div id="qr-reader" style={{ marginTop: 12, width: "100%", borderRadius: 8, overflow: "hidden" }} />}
        </div>

        {matchedQR && (
          <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <h2 style={{ fontWeight: 600, marginBottom: 12, color: "#111827", fontSize: 17 }}>QR Code: {codeText(matchedQR.fields["Code"])}</h2>

            {abonnement ? (
              <div>
                {clientInfo && (
                  <Info label="Client" value={`${clientInfo.fields["Nom"] || ""} ${clientInfo.fields["Téléphone"] ? "· " + clientInfo.fields["Téléphone"] : ""}`} />
                )}
                {vehInfo && <Info label="Véhicule" value={vehInfo.fields["Matriculation"]} />}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <Info label="Forfait" value={abonnement.fields["Forfait"]} />
                  <Info label="Lavages restants" value={abonnement.fields["Lavages restants"]} />
                  <Info label="Date début" value={abonnement.fields["Date début"]} />
                  <Info label="Date fin" value={abonnement.fields["Date fin"]} />
                </div>
                <Info label="Statut" value={statut} highlight={statut} />

                {statut === "VALIDE" && (
                  <button onClick={createLavage} disabled={loading}
                    style={btnStyle("#16a34a")}>{loading ? "..." : "Créer un lavage"}</button>
                )}

                {lastLavage && lastLavage.abonnementId === abonnement.id && (
                  <button onClick={undoLastLavage} disabled={loading}
                    style={{ ...btnStyle("white"), color: "#dc2626", border: "1px solid #fecaca" }}>
                    {loading ? "..." : "↩ Annuler le dernier lavage"}
                  </button>
                )}

                {(statut === "EXPIRÉ" || statut === "TERMINÉ") && (
                  <>
                    <button onClick={() => setShowEdit(!showEdit)} style={btnStyle("#ea580c")}>Renouveler l'abonnement</button>
                    {showEdit && (
                      <div style={boxStyle}>
                        <ForfaitPicker value={editA.forfait} onChange={(v) => setEditA({ ...editA, forfait: v })} />
                        <DateInput label="Date début" value={editA.dateDebut} onChange={(v) => setEditA({ ...editA, dateDebut: v })} />
                        <DateInput label="Date fin" value={editA.dateFin} onChange={(v) => setEditA({ ...editA, dateFin: v })} />
                        <button onClick={updateAbonnement} disabled={loading} style={btnStyle("black")}>
                          {loading ? "..." : "Confirmer le renouvellement"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div>
                <p style={{ marginBottom: 12, color: "#666" }}>Aucun abonnement lié à ce QR code.</p>
                <button onClick={() => setShowNew(!showNew)} style={btnStyle("#2563eb")}>Créer un abonnement</button>
                {showNew && (
                  <div style={boxStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ fontSize: 13, color: "#555" }}>Client</label>
                      <button type="button"
                        onClick={() => setNewA({ ...newA, createClient: !newA.createClient })}
                        style={toggleBtnStyle(newA.createClient)}>
                        {newA.createClient ? "Nouveau client" : "Client existant"}
                      </button>
                    </div>
                    {newA.createClient ? (
                      <>
                        <TextInput placeholder="Nom du client" value={newA.newClientName} onChange={(v) => setNewA({ ...newA, newClientName: v })} />
                        <TextInput placeholder="Téléphone" value={newA.newClientPhone} onChange={(v) => setNewA({ ...newA, newClientPhone: v })} />
                      </>
                    ) : (
                      <SelectInput
                        value={newA.clientId}
                        onChange={(v) => setNewA({ ...newA, clientId: v })}
                        placeholder="Sélectionner un client"
                        options={clients.map((c) => ({ value: c.id, label: c.fields["Nom"] || c.id }))}
                      />
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 6px" }}>
                      <label style={{ fontSize: 13, color: "#555" }}>Véhicule</label>
                      <button type="button"
                        onClick={() => setNewA({ ...newA, createVeh: !newA.createVeh })}
                        style={toggleBtnStyle(newA.createVeh)}>
                        {newA.createVeh ? "Nouveau véhicule" : "Véhicule existant"}
                      </button>
                    </div>
                    {newA.createVeh ? (
                      <>
                        <TextInput placeholder="Matriculation" value={newA.newVehMat} onChange={(v) => setNewA({ ...newA, newVehMat: v })} />
                        <TextInput placeholder="Marque" value={newA.newVehMarque} onChange={(v) => setNewA({ ...newA, newVehMarque: v })} />
                        <TextInput placeholder="Modèle" value={newA.newVehModele} onChange={(v) => setNewA({ ...newA, newVehModele: v })} />
                      </>
                    ) : (
                      <SelectInput
                        value={newA.vehiculeId}
                        onChange={(v) => setNewA({ ...newA, vehiculeId: v })}
                        placeholder="Sélectionner un véhicule"
                        options={vehicules.map((v) => ({ value: v.id, label: v.fields["Matriculation"] || v.id }))}
                      />
                    )}

                    <div style={{ marginTop: 12 }}>
                      <ForfaitPicker value={newA.forfait} onChange={(v) => setNewA({ ...newA, forfait: v })} />
                      <DateInput label="Date début" value={newA.dateDebut} onChange={(v) => setNewA({ ...newA, dateDebut: v })} />
                      <DateInput label="Date fin" value={newA.dateFin} onChange={(v) => setNewA({ ...newA, dateFin: v })} />
                      <button
                        onClick={createAbonnement}
                        disabled={
                          loading ||
                          (newA.createClient ? !newA.newClientName : !newA.clientId) ||
                          (newA.createVeh ? !newA.newVehMat : !newA.vehiculeId)
                        }
                        style={btnStyle("black")}
                      >
                        {loading ? "..." : "Créer l'abonnement"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!matchedQR && query.length >= 2 && (
          <div style={{ background: "white", borderRadius: 8, padding: 24, textAlign: "center" }}>
            Aucun QR code trouvé pour "{query}"
          </div>
        )}
    </div>
  );
}

const Info = ({ label, value, highlight }) => (
  <div style={{ background: "#f9fafb", padding: 10, borderRadius: 6, marginBottom: 8 }}>
    <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
    <div style={{ fontWeight: 600, color: highlight === "VALIDE" ? "#16a34a" : highlight === "EXPIRÉ" || highlight === "TERMINÉ" ? "#dc2626" : "#111" }}>
      {value ?? "-"}
    </div>
  </div>
);

const TextInput = ({ placeholder, value, onChange }) => (
  <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
    style={{ width: "100%", padding: 8, marginBottom: 8, border: "1px solid #ddd", borderRadius: 6 }} />
);

const DateInput = ({ label, value, onChange }) => (
  <div style={{ marginBottom: 8 }}>
    <label style={{ fontSize: 12, color: "#666" }}>{label}</label>
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", padding: 8, border: "1px solid #ddd", borderRadius: 6 }} />
  </div>
);

const ForfaitPicker = ({ value, onChange }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
    {Object.keys(FORFAITS).map((o) => (
      <button key={o} type="button" onClick={() => onChange(o)}
        style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd", background: value === o ? "#2563eb" : "white", color: value === o ? "white" : "black", fontSize: 13 }}>
        {o}
      </button>
    ))}
  </div>
);

const SelectInput = ({ value, onChange, placeholder, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}
    style={{ width: "100%", padding: 8, marginBottom: 8, border: "1px solid #ddd", borderRadius: 6, color: "#111827", background: "white" }}>
    <option value="">{placeholder}</option>
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const toggleBtnStyle = (active) => ({
  fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
  background: active ? "#2563eb" : "#e5e7eb", color: active ? "white" : "#374151",
});

const btnStyle = (bg) => ({
  width: "100%", padding: 10, background: bg, color: "white", border: "none", borderRadius: 6, marginTop: 8, cursor: "pointer",
});
const boxStyle = { marginTop: 12, padding: 12, background: "#f9fafb", borderRadius: 6 };