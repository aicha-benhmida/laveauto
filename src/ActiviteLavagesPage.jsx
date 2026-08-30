import { useEffect, useMemo, useState } from "react";
import * as at from "./airtable";
import { pctChange, MiniStatCard, TopBar, Pagination, downloadCSV, forfaitBadgeStyle, COLORS, FONT_DISPLAY, FONT_MONO, cardStyle } from "./shared";
import { CalendarIcon, DropletIcon, UsersIcon, CarIcon } from "./icons";

export default function ActiviteLavagesPage() {
  const [lavages, setLavages] = useState([]);
  const [clients, setClients] = useState([]);
  const [vehicules, setVehicules] = useState([]);
  const [abonnements, setAbonnements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  useEffect(() => {
    (async () => {
      const [la, cl, ve, ab] = await Promise.all([
        at.list("Lavages"), at.list("Clients"), at.list("Véhicules"), at.list("Abonnements"),
      ]);
      setLavages(la); setClients(cl); setVehicules(ve); setAbonnements(ab);
      setLoading(false);
    })();
  }, []);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const vehiculeMap = useMemo(() => new Map(vehicules.map((v) => [v.id, v])), [vehicules]);
  const abonnementMap = useMemo(() => new Map(abonnements.map((a) => [a.id, a])), [abonnements]);
  const clientById = (id) => clientMap.get(id);
  const vehiculeById = (id) => vehiculeMap.get(id);
  const abonnementById = (id) => abonnementMap.get(id);
  const washDate = (l) => (l.fields["Date/heure"] ? new Date(l.fields["Date/heure"]) : null);

  if (loading) return <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 24px", color: COLORS.inkMuted }}>Chargement...</div>;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfPrevWeek = new Date(startOfWeek); startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

  const inRange = (d, from, to) => d && d >= from && d < to;
  const thisWeekLavages = lavages.filter((l) => inRange(washDate(l), startOfWeek, new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)));
  const prevWeekLavages = lavages.filter((l) => inRange(washDate(l), startOfPrevWeek, startOfWeek));

  const uniqueClients = (arr) => new Set(arr.map((l) => l.fields["Client"]?.[0]).filter(Boolean)).size;
  const uniqueVehicules = (arr) => new Set(arr.map((l) => l.fields["Véhicule"]?.[0]).filter(Boolean)).size;

  const stats = {
    total: lavages.length,
    week: thisWeekLavages.length,
    weekTrend: pctChange(thisWeekLavages.length, prevWeekLavages.length),
    clients: uniqueClients(thisWeekLavages),
    clientsTrend: pctChange(uniqueClients(thisWeekLavages), uniqueClients(prevWeekLavages)),
    vehicules: uniqueVehicules(thisWeekLavages),
    vehiculesTrend: pctChange(uniqueVehicules(thisWeekLavages), uniqueVehicules(prevWeekLavages)),
  };

  const enriched = [...lavages]
    .sort((a, b) => new Date(b.fields["Date/heure"] || 0) - new Date(a.fields["Date/heure"] || 0))
    .map((l) => {
      const client = l.fields["Client"]?.[0] ? clientById(l.fields["Client"][0]) : null;
      const veh = l.fields["Véhicule"]?.[0] ? vehiculeById(l.fields["Véhicule"][0]) : null;
      const abo = l.fields["Abonnement"]?.[0] ? abonnementById(l.fields["Abonnement"][0]) : null;
      return { l, client, veh, abo, d: washDate(l) };
    })
    .filter(({ client, veh }) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (client?.fields["Nom"] || "").toLowerCase().includes(q) || (veh?.fields["Matriculation"] || "").toLowerCase().includes(q);
    });

  const totalPages = Math.max(1, Math.ceil(enriched.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = enriched.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportCSV = () => downloadCSV(
    "activite_lavages.csv",
    enriched.map(({ client, veh, abo, d }) => [
      d ? d.toLocaleDateString("fr-FR") : "-", d ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "-",
      client?.fields["Nom"] || "-", veh?.fields["Matriculation"] || "-", abo?.fields["Forfait"] || "-",
    ]),
    ["Date", "Heure", "Client", "Véhicule", "Forfait"]
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 24px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy, marginBottom: 2, fontFamily: FONT_DISPLAY }}>Activité lavages</h2>
      <p style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 20, marginTop: 0 }}>Historique complet des lavages effectués.</p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <MiniStatCard icon={<CalendarIcon />} label="Total lavages" value={stats.total} />
        <MiniStatCard icon={<DropletIcon />} label="Cette semaine" value={stats.week} trendPct={stats.weekTrend} trendLabel="vs sem. dernière" />
        <MiniStatCard icon={<UsersIcon />} label="Clients uniques" value={stats.clients} trendPct={stats.clientsTrend} trendLabel="vs sem. dernière" />
        <MiniStatCard icon={<CarIcon />} label="Véhicules lavés" value={stats.vehicules} trendPct={stats.vehiculesTrend} trendLabel="vs sem. dernière" />
      </div>

      <TopBar search={search} setSearch={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher client ou véhicule..." onExport={exportCSV} />

      <div style={cardStyle({ padding: 20, overflowX: "auto" })}>
        {enriched.length === 0 ? (
          <div style={{ color: COLORS.inkMuted, fontSize: 13 }}>Aucun lavage trouvé.</div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: COLORS.inkMuted }}>
                  <th style={thStyle}>Date &amp; Heure</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Véhicule</th>
                  <th style={thStyle}>Forfait</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ l, client, veh, abo, d }) => (
                  <tr key={l.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td style={{ padding: "10px 8px", color: COLORS.ink }}>
                      <div style={{ fontWeight: 700, color: COLORS.navy, fontFamily: FONT_MONO, fontSize: 13 }}>{d ? d.toLocaleDateString("fr-FR") : "-"}</div>
                      <div style={{ fontSize: 12, color: COLORS.inkMuted, fontFamily: FONT_MONO }}>{d ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "-"}</div>
                    </td>
                    <td style={{ padding: "10px 8px", color: COLORS.ink, fontWeight: 500 }}>{client?.fields["Nom"] || "-"}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 700, color: COLORS.navy, fontFamily: FONT_MONO }}>{veh?.fields["Matriculation"] || "-"}</td>
                    <td style={{ padding: "10px 8px" }}>
                      {abo ? <span style={forfaitBadgeStyle(abo.fields["Forfait"])}>{abo.fields["Forfait"]}</span> : "-"}
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