import { useEffect, useMemo, useState } from "react";
import * as at from "./airtable";
import {
  COLORS, cardStyle, MiniStatCard, TopBar, Pagination,
  pctChange, downloadCSV, isAbonnementValidForWash, classifyAbonnement,
} from "./shared";

const PAGE_SIZE = 10;

export default function ClientHistory() {
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [abonnements, setAbonnements] = useState([]);
  const [lavages, setLavages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      const [cl, ve, ab, la] = await Promise.all([
        at.list("Clients"), at.list("Véhicules"), at.list("Abonnements"), at.list("Lavages"),
      ]);
      setClients(cl); setVehicules(ve); setAbonnements(ab); setLavages(la);
      setLoading(false);
    })();
  }, []);

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = clients.filter((c) => c.createdTime && now - new Date(c.createdTime).getTime() < weekMs).length;
  const newLastWeek = clients.filter((c) => {
    if (!c.createdTime) return false;
    const age = now - new Date(c.createdTime).getTime();
    return age >= weekMs && age < weekMs * 2;
  }).length;
  const abonnementsActifs = abonnements.filter(isAbonnementValidForWash).length;

  const vehiculesByClient = useMemo(() => {
    const map = new Map();
    for (const v of vehicules) {
      for (const cId of v.fields["Client"] || []) {
        if (!map.has(cId)) map.set(cId, []);
        map.get(cId).push(v);
      }
    }
    return map;
  }, [vehicules]);

  const abonnementsByClient = useMemo(() => {
    const map = new Map();
    for (const a of abonnements) {
      for (const cId of a.fields["Client"] || []) {
        if (!map.has(cId)) map.set(cId, []);
        map.get(cId).push(a);
      }
    }
    return map;
  }, [abonnements]);

  const vehiculesFor = (clientId) => vehiculesByClient.get(clientId) || [];
  const abonnementsFor = (clientId) => abonnementsByClient.get(clientId) || [];

  const abonnementStatusFor = (clientId) => {
    const abs = abonnementsFor(clientId);
    if (abs.length === 0) return { label: "Aucun", color: COLORS.inkMuted };
    const usable = abs.find(isAbonnementValidForWash);
    if (usable) return { label: usable.fields["Forfait"] || "Actif", color: COLORS.green };
    return { label: "Expiré", color: COLORS.red };
  };


  const filtered = clients
    .filter((c) =>
      search.length === 0 ||
      (c.fields["Nom"] || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.fields["Téléphone"] || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (a.fields["Nom"] || "").localeCompare(b.fields["Nom"] || ""));

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    downloadCSV(
      "clients.csv",
      filtered.map((c) => {
        const st = abonnementStatusFor(c.id);
        const vs = vehiculesFor(c.id).map((v) => v.fields["Matriculation"]).join(" / ");
        return [c.fields["Nom"] || "", c.fields["Téléphone"] || "", c.fields["Email"] || "", vs, st.label];
      }),
      ["Nom", "Téléphone", "Email", "Véhicule(s)", "Abonnement"]
    );
  };

 
  if (selected) {
    const clientVehicules = vehiculesFor(selected.id);
    const clientAbonnements = abonnementsFor(selected.id);
    const clientAbonnementIds = clientAbonnements.map((a) => a.id);
    const clientLavages = lavages
      .filter((l) => l.fields["Client"]?.includes(selected.id) || l.fields["Abonnement"]?.some((id) => clientAbonnementIds.includes(id)))
      .sort((a, b) => new Date(b.fields["Date/heure"] || 0) - new Date(a.fields["Date/heure"] || 0));

    return (
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 24px" }}>
        <button
          onClick={() => setSelected(null)}
          style={{ background: "none", border: "none", color: COLORS.navy, cursor: "pointer", marginBottom: 16, fontSize: 14, padding: 0, fontWeight: 600 }}
        >
          ← Retour à la liste
        </button>

        <div style={cardStyle({ padding: 20, marginBottom: 16 })}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>{selected.fields["Nom"]}</h2>
          <div style={{ color: COLORS.inkMuted, fontSize: 14 }}>{selected.fields["Téléphone"] || "-"}</div>
          {selected.fields["Email"] && <div style={{ color: COLORS.inkMuted, fontSize: 14 }}>{selected.fields["Email"]}</div>}

          {clientVehicules.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 4 }}>Véhicule(s)</div>
              {clientVehicules.map((v) => (
                <div key={v.id} style={{ fontSize: 14, color: COLORS.ink }}>
                  {v.fields["Matriculation"]} {v.fields["Marque"] ? `· ${v.fields["Marque"]} ${v.fields["Modèle"] || ""}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle({ padding: 20, marginBottom: 16 })}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink, marginBottom: 12 }}>Abonnements ({clientAbonnements.length})</h3>
          {clientAbonnements.length === 0 && <p style={{ color: COLORS.inkMuted, fontSize: 14 }}>Aucun abonnement.</p>}
          {clientAbonnements.map((a, i) => {
            const usable = isAbonnementValidForWash(a);
            const s = a.fields["Statut"] || (classifyAbonnement(a) === "expired" ? "Expiré" : "Valide");
            return (
              <div
                key={a.id}
                style={{
                  padding: "12px 0",
                  borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: COLORS.ink }}>{a.fields["Forfait"]}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: usable ? COLORS.green : COLORS.red }}>{s}</span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.inkMuted }}>
                  {a.fields["Date début"]} → {a.fields["Date fin"]} · {a.fields["Lavages restants"]} lavages restants
                </div>
              </div>
            );
          })}
        </div>

        <div style={cardStyle({ padding: 20 })}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink, marginBottom: 12 }}>Historique des lavages ({clientLavages.length})</h3>
          {clientLavages.length === 0 && <p style={{ color: COLORS.inkMuted, fontSize: 14 }}>Aucun lavage enregistré.</p>}
          {clientLavages.map((l, i) => (
            <div
              key={l.id}
              style={{
                padding: "10px 0",
                borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}`,
                fontSize: 14, color: COLORS.ink,
              }}
            >
              {l.fields["Date/heure"] ? new Date(l.fields["Date/heure"]).toLocaleString("fr-FR") : "-"}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 24px" }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>Clients</h2>
      <p style={{ color: COLORS.inkMuted, fontSize: 14, marginBottom: 20 }}>Liste de tous les clients enregistrés.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <MiniStatCard label="Total clients" value={clients.length} />
        <MiniStatCard label="Abonnements actifs" value={abonnementsActifs} />
        <MiniStatCard
          label="Nouveaux cette semaine"
          value={newThisWeek}
          trendPct={pctChange(newThisWeek, newLastWeek)}
          trendLabel="vs sem. dernière"
        />
        <MiniStatCard label="Véhicules enregistrés" value={vehicules.length} />
      </div>

      <TopBar search={search} setSearch={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher client ou téléphone..." onExport={handleExport} />

      {loading && <p style={{ color: COLORS.inkMuted }}>Chargement...</p>}

      {!loading && (
        <div style={cardStyle({ overflow: "hidden" })}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1.6fr 1.3fr", padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
            {["CLIENT", "TÉLÉPHONE", "VÉHICULE(S)", "ABONNEMENT"].map((h) => (
              <span key={h} style={{ fontSize: 12, fontWeight: 600, color: COLORS.inkMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</span>
            ))}
          </div>

          {pageItems.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: COLORS.inkMuted, fontSize: 14 }}>
              Aucun client trouvé{search ? ` pour "${search}"` : ""}.
            </div>
          )}

          {pageItems.map((c, i) => {
            const st = abonnementStatusFor(c.id);
            const vs = vehiculesFor(c.id);
            const vLabel = vs.length === 0 ? "-" : vs.length === 1 ? vs[0].fields["Matriculation"] : `${vs[0].fields["Matriculation"]} +${vs.length - 1}`;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  display: "grid", gridTemplateColumns: "2fr 1.3fr 1.6fr 1.3fr", width: "100%",
                  textAlign: "left", padding: "14px 16px", background: "white", border: "none",
                  borderTop: i === 0 ? "none" : `1px solid ${COLORS.border}`, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <span style={{ fontWeight: 600, color: COLORS.ink, fontSize: 14 }}>{c.fields["Nom"] || "-"}</span>
                <span style={{ fontSize: 14, color: COLORS.ink }}>{c.fields["Téléphone"] || "-"}</span>
                <span style={{ fontSize: 14, color: COLORS.ink }}>{vLabel}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: st.color }}>{st.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <Pagination page={page} setPage={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
      )}
    </div>
  );
}