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
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return <QRSearchApp />;
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
      await at.create("Lavages", {
        Abonnement: [abonnement.id],
        "Date/heure": new Date().toISOString(),
        ...(client ? { Client: [client] } : {}),
        ...(veh ? { Véhicule: [veh] } : {}),
      });
      const used = (abonnement.fields["Lavages utilisés"] || 0) + 1;
      await at.update("Abonnements", abonnement.id, { "Lavages utilisés": used });
      showMsg("Lavage créé!");
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
    <div style={{ minHeight: "100vh", background: "#f9fafb", padding: "24px 16px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Recherche QR Code</h1>

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