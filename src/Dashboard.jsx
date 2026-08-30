import { useEffect, useMemo, useState } from "react";
import * as at from "./airtable";
import { FORFAITS, codeText, COLORS, FONT_DISPLAY, FONT_MONO, cardStyle, buttonStyle, StampBadge, forfaitBadgeStyle, classifyAbonnement } from "./shared";
import { DropletIcon, CheckCircleIcon, XCircleIcon, TagIcon, ScanIcon, PlusIcon, BellIcon } from "./icons";

export default function Dashboard({ onScanQR, onNewSubscription, onViewAllLavages, onViewAllAbonnements }) {
  const [abonnements, setAbonnements] = useState([]);
  const [lavages, setLavages] = useState([]);
  const [qrCodes, setQrCodes] = useState([]);
  const [clients, setClients] = useState([]);
  const [vehicules, setVehicules] = useState([]);
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
  const [currency, setCurrency] = useState(() => localStorage.getItem("laveauto_currency") || "$");

  useEffect(() => {
    (async () => {
      const [ab, la, qr, cl, ve] = await Promise.all([
        at.list("Abonnements"), at.list("Lavages"), at.list("QR Codes"),
        at.list("Clients"), at.list("Véhicules"),
      ]);
      setAbonnements(ab); setLavages(la); setQrCodes(qr); setClients(cl); setVehicules(ve);
      setLoading(false);
    })();
  }, []);

  useEffect(() => { localStorage.setItem("laveauto_prices", JSON.stringify(prices)); }, [prices]);
  useEffect(() => { localStorage.setItem("laveauto_threshold", String(threshold)); }, [threshold]);
  useEffect(() => { localStorage.setItem("laveauto_currency", currency); }, [currency]);

 
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const vehiculeMap = useMemo(() => new Map(vehicules.map((v) => [v.id, v])), [vehicules]);
  const qrMap = useMemo(() => new Map(qrCodes.map((q) => [q.id, q])), [qrCodes]);

  if (loading) return <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 16px 24px", color: COLORS.inkMuted }}>Chargement...</div>;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 6);

  const washDate = (l) => (l.fields["Date/heure"] ? new Date(l.fields["Date/heure"]) : null);
  const todayCount = lavages.filter((l) => { const d = washDate(l); return d && d >= startOfToday; }).length;
  const weekCount = lavages.filter((l) => { const d = washDate(l); return d && d >= startOfWeek; }).length;

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
  const availableQR = byStatusLabel > 0 ? byStatusLabel : byNoLink;
  const lowStock = availableQR < threshold;

  const clientById = (id) => clientMap.get(id);
  const vehiculeById = (id) => vehiculeMap.get(id);
  const qrById = (id) => qrMap.get(id);

  const statusCounts = abonnements.reduce(
    (acc, a) => { acc[classifyAbonnement(a)]++; return acc; },
    { active: 0, expiring: 0, expired: 0 }
  );
  const statusTotal = statusCounts.active + statusCounts.expiring + statusCounts.expired;

  const validCount = statusCounts.active + statusCounts.expiring;
  const expiredCount = statusCounts.expired;

  const recentSubs = [...abonnements]
    .filter((a) => a.fields["Date début"])
    .sort((a, b) => new Date(b.fields["Date début"]) - new Date(a.fields["Date début"]))
    .slice(0, 2);

  const weekLavages = lavages
    .filter((l) => { const d = washDate(l); return d && d >= startOfWeek; })
    .sort((a, b) => new Date(b.fields["Date/heure"]) - new Date(a.fields["Date/heure"]));

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 16px 24px" }}>
      {lowStock && (
        <div style={{ color: COLORS.amber, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
          <span style={{ display: "flex" }}><BellIcon /></span>
          <span>Il ne reste que <strong>{availableQR}</strong> QR codes disponibles (seuil: {threshold}). Pensez à en réimprimer.</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "stretch" }}>
        <button onClick={onScanQR} style={buttonStyle("ghost")}>
          <ScanIcon /> Scanner un QR Code
        </button>
        <button onClick={onNewSubscription} style={buttonStyle("amber")}>
          <PlusIcon /> Nouvel abonnement
        </button>
        <ThresholdInline threshold={threshold} setThreshold={setThreshold} lowStock={lowStock} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <StatCard icon={<DropletIcon />} label="Lavages aujourd'hui" value={todayCount} />
        <StatCard icon={<DropletIcon />} label="Lavages (7 jours)" value={weekCount} />
        <StatCard icon={<CheckCircleIcon />} label="Abonnements actifs" value={validCount} valueColor={COLORS.green}
          subtext={abonnements.length ? `${Math.round((validCount / abonnements.length) * 100)}% du total` : null} />
        <StatCard icon={<XCircleIcon />} label="Abonnements expirés" value={expiredCount} valueColor={COLORS.red}
          subtext={abonnements.length ? `${Math.round((expiredCount / abonnements.length) * 100)}% du total` : null} />
        <StatCard icon={<TagIcon />} label="QR codes disponibles" value={availableQR} valueColor={lowStock ? COLORS.red : COLORS.navy} />
        <StatCard icon={<TagIcon />} label="QR codes total" value={qrCodes.length} subtext={`${qrCodes.length - availableQR} utilisés`} />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <DonutCard counts={statusCounts} total={statusTotal} />
        <WashActivityCard lavages={weekLavages} clientById={clientById} vehiculeById={vehiculeById} onViewAll={onViewAllLavages} />
      </div>

      <RecentSubscriptionsCard subs={recentSubs} clientById={clientById} vehiculeById={vehiculeById} qrById={qrById} classify={classifyAbonnement} onViewAll={onViewAllAbonnements} />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <RevenuePricingCard
          prices={prices} setPrices={setPrices}
          currency={currency} setCurrency={setCurrency}
          revenueEstimate={revenueEstimate} newSubsCount={abonnementsThisWeek.length}
        />
      </div>
    </div>
  );
}

const StatCard = ({ icon, label, value, subtext, valueColor }) => (
  <div style={cardStyle({ padding: "14px 16px", flex: "1 1 150px", minWidth: 150 })}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", color: COLORS.inkMuted, textTransform: "uppercase", maxWidth: "80%" }}>{label}</div>
      <span style={{ color: COLORS.navySoft, opacity: 0.5 }}>{icon}</span>
    </div>
    <div style={{ fontSize: 26, fontWeight: 700, color: valueColor || COLORS.navy, fontFamily: FONT_DISPLAY, lineHeight: 1 }}>{value}</div>
    {subtext && <div style={{ fontSize: 12, color: COLORS.inkMuted, marginTop: 6 }}>{subtext}</div>}
  </div>
);
function ThresholdInline({ threshold, setThreshold, lowStock }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 4px" }}>
      <span style={{ color: lowStock ? COLORS.amber : COLORS.inkMuted, display: "flex" }}><BellIcon /></span>
      <span style={{ fontSize: 13, color: COLORS.inkMuted, whiteSpace: "nowrap" }}>Seuil QR</span>
      <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
        style={{ width: 44, padding: "4px 6px", border: "none", borderBottom: `1px solid ${COLORS.border}`, textAlign: "center", color: COLORS.ink, fontSize: 13, background: "transparent" }} />
    </div>
  );
}

function DonutChart({ counts, total }) {
  const r = 45, c = 2 * Math.PI * r;
  const segments = [
    { key: "active", color: COLORS.green, value: counts.active },
    { key: "expiring", color: COLORS.amberDark, value: counts.expiring },
    { key: "expired", color: COLORS.red, value: counts.expired },
  ];
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" style={{ width: 110, height: 110, flexShrink: 0 }}>
      <g transform="rotate(-90 60 60)">
        {total === 0 ? (
          <circle cx="60" cy="60" r={r} fill="none" stroke={COLORS.border} strokeWidth="14" />
        ) : segments.map((s) => {
          if (s.value === 0) return null;
          const len = (s.value / total) * c;
          const el = (
            <circle key={s.key} cx="60" cy="60" r={r} fill="none" stroke={s.color} strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
}

function DonutCard({ counts, total }) {
  const rows = [
    { key: "active", label: "Actif", color: COLORS.green },
    { key: "expiring", label: "Expire bientôt", color: COLORS.amberDark },
    { key: "expired", label: "Expiré", color: COLORS.red },
  ];
  return (
    <div style={cardStyle({ padding: 20, flex: "1 1 300px" })}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: COLORS.amberDark, textTransform: "uppercase", marginBottom: 16 }}>Statut des abonnements</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <DonutChart counts={counts} total={total} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => (
            <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.ink, minWidth: 150 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: r.color, display: "inline-block" }} />
              <span style={{ flex: 1 }}>{r.label}</span>
              <span style={{ fontWeight: 700, color: COLORS.navy, fontFamily: FONT_MONO }}>
                {counts[r.key]}{total > 0 ? ` (${Math.round((counts[r.key] / total) * 100)}%)` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function WashActivityCard({ lavages, clientById, vehiculeById, onViewAll }) {
  const visible = lavages.slice(0, 2);

  return (
    <div style={cardStyle({ padding: 20, flex: "1 1 300px", overflowX: "auto" })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: COLORS.amberDark, textTransform: "uppercase" }}>Activité lavages (semaine)</div>
        {lavages.length > 2 && (
          <button onClick={onViewAll} style={{ background: "none", border: "none", color: COLORS.navy, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
            Voir plus
          </button>
        )}
      </div>
      {lavages.length === 0 ? (
        <div style={{ color: COLORS.inkMuted, fontSize: 13 }}>Aucun lavage cette semaine.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: COLORS.inkMuted }}>
              <th style={{ padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Véhicule</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Client</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Date</th>
              <th style={{ padding: "6px 8px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Heure</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l) => {
              const cId = l.fields["Client"]?.[0];
              const vId = l.fields["Véhicule"]?.[0];
              const client = cId ? clientById(cId) : null;
              const veh = vId ? vehiculeById(vId) : null;
              const d = l.fields["Date/heure"] ? new Date(l.fields["Date/heure"]) : null;
              return (
                <tr key={l.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "8px", fontWeight: 700, color: COLORS.navy, fontFamily: FONT_MONO }}>{veh?.fields["Matriculation"] || "-"}</td>
                  <td style={{ padding: "8px", color: COLORS.ink }}>{client?.fields["Nom"] || "-"}</td>
                  <td style={{ padding: "8px", color: COLORS.ink, fontFamily: FONT_MONO, fontSize: 12 }}>{d ? d.toLocaleDateString("fr-FR") : "-"}</td>
                  <td style={{ padding: "8px", color: COLORS.ink, fontFamily: FONT_MONO, fontSize: 12 }}>{d ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
function RecentSubscriptionsCard({ subs, clientById, vehiculeById, qrById, classify, onViewAll }) {
  return (
    <div style={cardStyle({ padding: 20, marginBottom: 16 })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: COLORS.amberDark, textTransform: "uppercase" }}>Abonnements récents</div>
        <button onClick={onViewAll} style={{ background: "none", border: "none", color: COLORS.navy, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" }}>
          Voir plus
        </button>
      </div>
      {subs.length === 0 ? (
        <div style={{ color: COLORS.inkMuted, fontSize: 13, marginTop: 8 }}>Aucun abonnement.</div>
      ) : subs.map((a) => {
        const cId = a.fields["Client"]?.[0];
        const vId = a.fields["Véhicule"]?.[0];
        const qId = a.fields["QR Code"]?.[0];
        const client = cId ? clientById(cId) : null;
        const veh = vId ? vehiculeById(vId) : null;
        const qr = qId ? qrById(qId) : null;
        const status = classify(a);
        return (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: COLORS.navy, fontSize: 14, fontFamily: FONT_MONO }}>{qr ? codeText(qr.fields["Code"]) : "-"}</div>
              <div style={{ fontSize: 12, color: COLORS.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {client?.fields["Nom"] || "-"}{veh?.fields["Matriculation"] ? ` · ${veh.fields["Matriculation"]}` : ""}
              </div>
            </div>
            <span style={forfaitBadgeStyle(a.fields["Forfait"])}>{a.fields["Forfait"]}</span>
            <StampBadge status={status} />
            <div style={{ fontSize: 11, color: COLORS.inkMuted, textAlign: "right", minWidth: 90, fontFamily: FONT_MONO }}>
              {status === "expired" ? "expiré" : "valide jusqu'au"}<br />
              <span style={{ color: COLORS.ink, fontWeight: 600 }}>{a.fields["Date fin"] || "-"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RevenuePricingCard({ prices, setPrices, currency, setCurrency, revenueEstimate, newSubsCount }) {
  return (
    <div style={cardStyle({ padding: 20, flex: "1 1 300px" })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: COLORS.amberDark, textTransform: "uppercase" }}>Revenu estimé (7j)</span>
        <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.navy, fontFamily: FONT_DISPLAY }}>{revenueEstimate} {currency}</span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkMuted, marginBottom: 16 }}>Basé sur {newSubsCount} nouveaux abonnements et les prix ci-dessous</div>

      <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>Prix par forfait</div>
      {Object.keys(FORFAITS).map((f) => (
        <div key={f} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: COLORS.ink }}>{f}</span>
          <input type="number" value={prices[f]} onChange={(e) => setPrices({ ...prices, [f]: Number(e.target.value) })}
            style={{ width: 90, padding: 6, border: `1px solid ${COLORS.border}`, borderRadius: 4, textAlign: "right", color: COLORS.ink, fontFamily: FONT_MONO, background: COLORS.card }} />
        </div>
      ))}
    </div>
  );
}