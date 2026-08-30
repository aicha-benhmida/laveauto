import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import * as at from "./airtable";
import { FORFAITS, codeText, COLORS, buttonStyle, Toast, isAbonnementValidForWash } from "./shared";
import { ScanIcon, CheckCircleIcon } from "./icons";

const friendlyError = (raw) => {
  if (raw.includes("INVALID_VALUE_FOR_COLUMN")) return "Vérifiez que tous les champs sont bien remplis.";
  if (raw.includes("401") || raw.includes("403")) return "Problème d'accès à la base de données.";
  if (raw.includes("404")) return "Élément introuvable.";
  return "Une erreur est survenue. Réessayez.";
};

export default function QRSearchApp({ pendingAction, onActionHandled, onViewAllLavages }) {
  const [query, setQuery] = useState("");
  const [qrRecords, setQrRecords] = useState([]);
  const [clients, setClients] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [abonnements, setAbonnements] = useState([]);
  const [lavages, setLavages] = useState([]);
  const [matchedQR, setMatchedQR] = useState(null);
  const [abonnement, setAbonnement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [lastLavage, setLastLavage] = useState(null);
  const scannerRef = useRef(null);
  const inputRef = useRef(null);

  const [newA, setNewA] = useState({
    clientId: "", vehiculeId: "", forfait: "5 Lavages",
    dateDebut: new Date().toISOString().split("T")[0], dateFin: "",
    newClientName: "", newClientPhone: "",
    newVehMat: "", newVehMarque: "", newVehModele: "",
    createClient: true, createVeh: true,
  });
  const [editA, setEditA] = useState({ forfait: "5 Lavages", dateDebut: "", dateFin: "" });

  const refresh = async () => {
    const [qr, cl, ve, ab, la] = await Promise.all([
      at.list("QR Codes"), at.list("Clients"), at.list("Véhicules"), at.list("Abonnements"), at.list("Lavages"),
    ]);
    setQrRecords(qr); setClients(cl); setVehicules(ve); setAbonnements(ab); setLavages(la);
  };
  const refreshLavagesOnly = async () => {
    const la = await at.list("Lavages");
    setLavages(la);
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (query.length >= 2) {
      const found = qrRecords.find((r) =>
        codeText(r.fields["Code"]).toLowerCase() === query.toLowerCase()
      );
      setMatchedQR(found || null);
    } else setMatchedQR(null);
  }, [query, qrRecords]);

  useEffect(() => {
    const loadAbonnement = async () => {
      setLastLavage(null);
      if (!matchedQR?.fields["Abonnement"]?.length) { setAbonnement(null); return; }
      const found = abonnements.find((r) => r.id === matchedQR.fields["Abonnement"][0]);
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
  const showErr = (t) => { setErr(t); setTimeout(() => setErr(""), 4000); };

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
        showErr("Erreur caméra: " + e.message);
        setScanning(false);
      }
    }, 100);
  };
  const stopCamera = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch { /* already stopped */ }
      scannerRef.current = null;
    }
  };

  const stopScan = async () => {
    await stopCamera();
    setScanning(false);
  };
  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  useEffect(() => {
    if (!pendingAction) return;
    if (pendingAction === "scan") startScan();
    else if (pendingAction === "new") inputRef.current?.focus();
    onActionHandled?.();
  }, [pendingAction]);

  const createLavage = async () => {
    setErr("");
    if (!abonnement || !isAbonnementValidForWash(abonnement)) {
      showErr("Cet abonnement est expiré. Veuillez le renouveler.");
      return;
    }
    setLoading(true);
    let created = null;
    try {
      const client = abonnement.fields["Client"]?.[0];
      const veh = abonnement.fields["Véhicule"]?.[0];
      created = await at.create("Lavages", {
        Abonnement: [abonnement.id],
        "Date/heure": new Date().toISOString(),
        ...(client ? { Client: [client] } : {}),
        ...(veh ? { Véhicule: [veh] } : {}),
      });
      const used = (abonnement.fields["Lavages utilisés"] || 0) + 1;
      const updated = await at.update("Abonnements", abonnement.id, { "Lavages utilisés": used });
      setAbonnement(updated);
      setLastLavage({ id: created.id, abonnementId: abonnement.id });
      showMsg("Lavage créé!");
      setLavages((prev) =>[created, ...prev]);
    } catch (e) {
  
      if (created) {
        try { await at.remove("Lavages", created.id); }
        catch {  }
      }
      showErr(friendlyError(e.message));
    }
    setLoading(false);
  };

  const undoLastLavage = async () => {
    if (!lastLavage) return;
    setErr(""); setLoading(true);
    const { id: lavageId, abonnementId } = lastLavage;

    try {
      await at.remove("Lavages", lavageId);
    } catch (e) {
      showErr(friendlyError(e.message));
      setLoading(false);
      return;
    }

    try {
      const used = Math.max((abonnement.fields["Lavages utilisés"] || 0) - 1, 0);
      const updated = await at.update("Abonnements", abonnementId, { "Lavages utilisés": used });
      setAbonnement(updated);
      setLastLavage(null);
      showMsg("Dernier lavage annulé.");
      await refreshLavagesOnly();
    } catch {
      showErr("Le lavage a été annulé mais le compteur n'a pas pu être mis à jour. Vérifiez cet abonnement manuellement.");
    }
    setLoading(false);
  };

  const updateAbonnement = async () => {
    setErr("");
    const today = new Date().toISOString().split("T")[0];
    if (!editA.dateDebut || !editA.dateFin) { showErr("Merci de renseigner la date début et la date fin."); return; }
    if (editA.dateFin < today) { showErr("La date fin ne peut pas être dans le passé pour un renouvellement."); return; }
    if (editA.dateFin <= editA.dateDebut) { showErr("La date fin doit être après la date début."); return; }
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
      setLastLavage(null);
      showMsg("Abonnement renouvelé!");
      const updated = await at.get("Abonnements", abonnement.id);
      setAbonnement(updated || null);
    } catch (e) { showErr(friendlyError(e.message)); }
    setLoading(false);
  };

  const createAbonnement = async () => {
    setErr("");
    const today = new Date().toISOString().split("T")[0];
    if (!newA.dateDebut || !newA.dateFin) { showErr("Merci de renseigner la date début et la date fin."); return; }
    if (newA.dateFin < today) { showErr("La date fin ne peut pas être dans le passé."); return; }
    if (newA.dateFin <= newA.dateDebut) { showErr("La date fin doit être après la date début."); return; }
    setLoading(true);
    try {
      let clientId = newA.clientId;
      let vehId = newA.vehiculeId;

      if (newA.createClient) {
        const rec = await at.create("Clients", { Nom: newA.newClientName, Téléphone: newA.newClientPhone });
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
    } catch (e) { showErr(friendlyError(e.message)); }
    setLoading(false);
  };

  const statut = abonnement?.fields["Statut"];
  const clientInfo = abonnement && clients.find((c) => c.id === abonnement.fields["Client"]?.[0]);
  const vehInfo = abonnement && vehicules.find((v) => v.id === abonnement.fields["Véhicule"]?.[0]);

  const abonnementById = (id) => abonnements.find((a) => a.id === id);
  const recentLavages = [...lavages]
    .sort((a, b) => new Date(b.fields["Date/heure"] || 0) - new Date(a.fields["Date/heure"] || 0))
    .slice(0, 5)
    .map((l) => {
      const client = l.fields["Client"]?.[0] ? clients.find((c) => c.id === l.fields["Client"][0]) : null;
      const veh = l.fields["Véhicule"]?.[0] ? vehicules.find((v) => v.id === l.fields["Véhicule"][0]) : null;
      const abo = l.fields["Abonnement"]?.[0] ? abonnementById(l.fields["Abonnement"][0]) : null;
      const d = l.fields["Date/heure"] ? new Date(l.fields["Date/heure"]) : null;
      return { id: l.id, client, veh, abo, d };
    });

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 24px" }}>
      <Toast message={msg} type="success" />
      <Toast message={err} type="error" />

      {/* ---- Search / scan ---- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un code QR..."
          style={{ flex: 1, padding: 11, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontSize: 15, color: COLORS.ink, outline: "none" }} />
        <button onClick={scanning ? stopScan : startScan}
          style={buttonStyle(scanning ? "amber" : "navy", { padding: "11px 16px" })}>
          <ScanIcon /> {scanning ? "Arrêter" : "Scanner"}
        </button>
      </div>
      {scanning && <div id="qr-reader" style={{ marginTop: 12, width: "100%", borderRadius: 8, overflow: "hidden" }} />}

      {!matchedQR && query.length >= 2 && (
        <div style={{ color: COLORS.inkMuted, fontSize: 14, marginTop: 12 }}>
          Aucun QR code trouvé pour "{query}"
        </div>
      )}

      {/* ---- Result card: shows under search, above Recent Scans ---- */}
      {matchedQR && (
        <div style={{ marginTop: 20, paddingTop: 4 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 16, color: COLORS.ink, fontSize: 16 }}>QR Code : {codeText(matchedQR.fields["Code"])}</h2>

          {abonnement ? (
            <div>
              {clientInfo && <Info label="Client" value={`${clientInfo.fields["Nom"] || ""} ${clientInfo.fields["Téléphone"] ? "· " + clientInfo.fields["Téléphone"] : ""}`} />}
              {vehInfo && <Info label="Véhicule" value={vehInfo.fields["Matriculation"]} />}
              <Info label="Forfait" value={abonnement.fields["Forfait"]} />
              <Info label="Lavages restants" value={abonnement.fields["Lavages restants"]} />
              <Info label="Date début" value={abonnement.fields["Date début"]} />
              <Info label="Date fin" value={abonnement.fields["Date fin"]} />
              <Info label="Statut" value={statut} highlight={statut} />

              {isAbonnementValidForWash(abonnement) && (
                <button onClick={createLavage} disabled={loading} style={buttonStyle("navy", { width: "100%", justifyContent: "center", marginTop: 16 })}>
                  {loading ? "..." : "Créer un lavage"}
                </button>
              )}

              {lastLavage && lastLavage.abonnementId === abonnement.id && (
                <button onClick={undoLastLavage} disabled={loading}
                  style={buttonStyle("ghost", { width: "100%", justifyContent: "center", marginTop: 8, color: COLORS.red })}>
                  {loading ? "..." : "↩ Annuler le dernier lavage"}
                </button>
              )}

              {!isAbonnementValidForWash(abonnement) && (
                <>
                  <button onClick={() => setShowEdit(!showEdit)} style={buttonStyle("amber", { width: "100%", justifyContent: "center", marginTop: 16 })}>
                    Renouveler l'abonnement
                  </button>
                  {showEdit && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
                      <ForfaitPicker value={editA.forfait} onChange={(v) => setEditA({ ...editA, forfait: v })} />
                      <DateInput label="Date début" value={editA.dateDebut} onChange={(v) => setEditA({ ...editA, dateDebut: v })} />
                      <DateInput label="Date fin" value={editA.dateFin} onChange={(v) => setEditA({ ...editA, dateFin: v })} />
                      <button onClick={updateAbonnement} disabled={loading} style={buttonStyle("navy", { width: "100%", justifyContent: "center", marginTop: 8 })}>
                        {loading ? "..." : "Confirmer le renouvellement"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: 12, color: COLORS.inkMuted, fontSize: 14 }}>Aucun abonnement lié à ce QR code.</p>
              <button onClick={() => setShowNew(!showNew)} style={buttonStyle("navy", { width: "100%", justifyContent: "center" })}>
                Créer un abonnement
              </button>
              {showNew && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 13, color: COLORS.inkMuted }}>Client</label>
                    <button type="button" onClick={() => setNewA({ ...newA, createClient: !newA.createClient })} style={toggleLinkStyle}>
                      {newA.createClient ? "→ Client existant" : "→ Nouveau client"}
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
                    <label style={{ fontSize: 13, color: COLORS.inkMuted }}>Véhicule</label>
                    <button type="button" onClick={() => setNewA({ ...newA, createVeh: !newA.createVeh })} style={toggleLinkStyle}>
                      {newA.createVeh ? "→ Véhicule existant" : "→ Nouveau véhicule"}
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
                      style={buttonStyle("navy", { width: "100%", justifyContent: "center", marginTop: 8 })}
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

      {/* ---- Recent Scans: always visible, right under search (or under result card) ---- */}
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, margin: 0 }}>Derniers lavages</h3>
          {onViewAllLavages && (
            <button onClick={onViewAllLavages} style={{ background: "none", border: "none", color: COLORS.navy, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
              Voir tout
            </button>
          )}
        </div>
        {recentLavages.length === 0 ? (
          <div style={{ color: COLORS.inkMuted, fontSize: 14 }}>Aucun lavage enregistré.</div>
        ) : recentLavages.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: COLORS.ink, fontSize: 14 }}>{r.veh?.fields["Matriculation"] || "-"}</div>
              <div style={{ fontSize: 13, color: COLORS.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.client?.fields["Nom"] || "-"}{r.abo ? ` · ${r.abo.fields["Forfait"]}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: COLORS.inkMuted, whiteSpace: "nowrap" }}>{formatRelative(r.d)}</span>
              <span style={{ color: COLORS.green, display: "flex" }}><CheckCircleIcon /></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRelative(d) {
  if (!d) return "-";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d >= startOfToday) return `Aujourd'hui, ${time}`;
  if (d >= startOfYesterday) return `Hier, ${time}`;
  return `${d.toLocaleDateString("fr-FR")}, ${time}`;
}

const Info = ({ label, value, highlight }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "9px 0", borderBottom: `1px solid ${COLORS.border}` }}>
    <span style={{ fontSize: 13, color: COLORS.inkMuted }}>{label}</span>
    <span style={{ fontWeight: 600, fontSize: 14, color: highlight === "VALIDE" ? COLORS.green : highlight === "EXPIRÉ" || highlight === "TERMINÉ" ? COLORS.red : COLORS.ink }}>
      {value ?? "-"}
    </span>
  </div>
);

const TextInput = ({ placeholder, value, onChange }) => (
  <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
    style={{ width: "100%", padding: 8, marginBottom: 8, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.ink }} />
);

const DateInput = ({ label, value, onChange }) => (
  <div style={{ marginBottom: 8 }}>
    <label style={{ fontSize: 12, color: COLORS.inkMuted }}>{label}</label>
    <input type="date" value={value} onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", padding: 8, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.ink }} />
  </div>
);

const ForfaitPicker = ({ value, onChange }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
    {Object.keys(FORFAITS).map((o) => (
      <button key={o} type="button" onClick={() => onChange(o)}
        style={{ padding: 8, borderRadius: 6, border: `1px solid ${value === o ? COLORS.navy : COLORS.border}`, background: value === o ? COLORS.navy : "white", color: value === o ? "white" : COLORS.ink, fontSize: 13, cursor: "pointer" }}>
        {o}
      </button>
    ))}
  </div>
);

const SelectInput = ({ value, onChange, placeholder, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}
    style={{ width: "100%", padding: 8, marginBottom: 8, border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.ink, background: "white" }}>
    <option value="">{placeholder}</option>
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const toggleLinkStyle = {
  fontSize: 12, padding: 0, border: "none", background: "none", cursor: "pointer",
  color: COLORS.navy, textDecoration: "underline", fontWeight: 500,
};