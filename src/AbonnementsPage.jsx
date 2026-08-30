import { useEffect, useMemo, useState } from "react";
import * as at from "./airtable";
import { codeText, MiniStatCard, TopBar, Pagination, downloadCSV, forfaitBadgeStyle, StampBadge, COLORS, FONT_DISPLAY, FONT_MONO, cardStyle, classifyAbonnement } from "./shared";
import { TagIcon, CheckCircleIcon, CalendarIcon, XCircleIcon } from "./icons";

export default function AbonnementsPage() {
  const [abonnements, setAbonnements] = useState([]);
  const [clients, setClients] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [qrCodes, setQrCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    (async () => {
      const [ab, cl, ve, qr] = await Promise.all([
        at.list("Abonnements"), at.list("Clients"), at.list("Véhicules"), at.list("QR Codes"),
      ]);
      setAbonnements(ab); setClients(cl); setVehicules(ve); setQrCodes(qr);
      setLoading(false);
    })();
  }, []);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const vehiculeMap = useMemo(() => new Map(vehicules.map((v) => [v.id, v])), [vehicules]);
  const qrMap = useMemo(() => new Map(qrCodes.map((q) => [q.id, q])), [qrCodes]);
  const clientById = (id) => clientMap.get(id);
  const vehiculeById = (id) => vehiculeMap.get(id);
  const qrById = (id) => qrMap.get(id);

  if (loading) return <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 24px", color: COLORS.inkMuted }}>Chargement...</div>;

  const counts = abonnements.reduce(
    (acc, a) => { acc[classifyAbonnement(a)]++; return acc; },
    { active: 0, expiring: 0, expired: 0 }
  );

  const enriched = [...abonnements]
    .filter((a) => a.fields["Date début"])
    .sort((a, b) => new Date(b.fields["Date début"]) - new Date(a.fields["Date début"]))
    .map((a) => {
      const client = a.fields["Client"]?.[0] ? clientById(a.fields["Client"][0]) : null;
      const veh = a.fields["Véhicule"]?.[0] ? vehiculeById(a.fields["Véhicule"][0]) : null;
      const qr = a.fields["QR Code"]?.[0] ? qrById(a.fields["QR Code"][0]) : null;
      return { a, client, veh, qr, status: classifyAbonnement(a) };
    })
    .filter(({ client, veh, qr }) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (client?.fields["Nom"] || "").toLowerCase().includes(q)
        || (veh?.fields["Matriculation"] || "").toLowerCase().includes(q)
        || (qr ? codeText(qr.fields["Code"]) : "").toLowerCase().includes(q);
    });

  const totalPages = Math.max(1, Math.ceil(enriched.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = enriched.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportCSV = () => downloadCSV(
    "abonnements.csv",
    enriched.map(({ client, veh, qr, a, status }) => [
      qr ? codeText(qr.fields["Code"]) : "-", client?.fields["Nom"] || "-", veh?.fields["Matriculation"] || "-",
      a.fields["Forfait"] || "-", status, a.fields["Date début"] || "-", a.fields["Date fin"] || "-",
    ]),
    ["Code", "Client", "Véhicule", "Forfait", "Statut", "Date début", "Date fin"]
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 24px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy, marginBottom: 2, fontFamily: FONT_DISPLAY }}>Abonnements</h2>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 20, marginTop: 0 }}>Vue d'ensemble de tous les abonnements.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <MiniStatCard icon={<TagIcon />} label="Total abonnements" value={abonnements.length} />
        <MiniStatCard icon={<CheckCircleIcon />} label="Actifs" value={counts.active} />
        <MiniStatCard icon={<CalendarIcon />} label="Expire bientôt" value={counts.expiring} />
        <MiniStatCard icon={<XCircleIcon />} label="Expirés" value={counts.expired} />
      </div>

      <TopBar search={search} setSearch={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher client, véhicule ou code..." onExport={exportCSV} />

      <div style={cardStyle({ padding: 20, overflowX: "auto" })}>
        {enriched.length === 0 ? (
          <div style={{ color: COLORS.inkMuted, fontSize: 13 }}>Aucun abonnement trouvé.</div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: COLORS.inkMuted }}>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Véhicule</th>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Forfait</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Validité</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ a, client, veh, qr, status }) => (
                  <tr key={a.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "10px 8px", color: COLORS.ink, fontWeight: 500 }}>{client?.fields["Nom"] || "-"}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 700, color: COLORS.navy, fontFamily: FONT_MONO }}>{veh?.fields["Matriculation"] || "-"}</td>
                    <td style={{ padding: "10px 8px", color: COLORS.ink, fontFamily: FONT_MONO, fontSize: 12 }}>{qr ? codeText(qr.fields["Code"]) : "-"}</td>
                    <td style={{ padding: "10px 8px" }}><span style={forfaitBadgeStyle(a.fields["Forfait"])}>{a.fields["Forfait"] || "-"}</span></td>
                    <td style={{ padding: "10px 8px" }}><StampBadge status={status} /></td>
                    <td style={{ padding: "10px 8px", color: COLORS.ink, whiteSpace: "nowrap", fontFamily: FONT_MONO, fontSize: 12 }}>
                      {a.fields["Date début"] || "-"} → {a.fields["Date fin"] || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={currentPage} setPage={setPage} totalItems={enriched.length} pageSize={pageSize} />
          </>
        )}
      </div>
    </div>
  );
}

const thStyle = { padding: "6px 8px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" };