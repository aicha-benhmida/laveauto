import { SearchIcon, DownloadIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

export const FORFAITS = { "5 Lavages": 5, "10 Lavages": 10, "20 Lavages": 20 };

export const codeText = (val) => (val && typeof val === "object" ? val.text || "" : val || "");

export const COLORS = {
  navy: "#1f2937",
  navySoft: "#6b7280",
  amber: "#b45309",
  amberDark: "#b45309",
  amberBg: "#fef3c7",
  paper: "#ffffff",
  card: "#ffffff",
  border: "#e5e7eb",
  ink: "#111827",
  inkMuted: "#6b7280",
  green: "#16a34a",
  red: "#dc2626",
};

export const FONT_DISPLAY = "inherit";
export const FONT_MONO = "inherit";

export function useGarageFonts() {
}

export const cardStyle = (extra = {}) => ({
  background: COLORS.card,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 12,
  ...extra,
});

export const buttonStyle = (variant = "navy", extra = {}) => {
  const variants = {
    navy: { bg: COLORS.navy, color: "#fff", border: COLORS.navy },
    amber: { bg: COLORS.amber, color: "#fff", border: COLORS.amber },
    ghost: { bg: "#fff", color: COLORS.navy, border: COLORS.border },
  };
  const v = variants[variant] || variants.navy;
  return {
    display: "flex", alignItems: "center", gap: 8, padding: "10px 18px",
    borderRadius: 8, border: `1px solid ${v.border}`, background: v.bg, color: v.color,
    fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
    ...extra,
  };
};
const STATUS_MAP = {
  active: { color: COLORS.green, label: "Actif" },
  expiring: { color: COLORS.amber, label: "Expire bientôt" },
  expired: { color: COLORS.red, label: "Expiré" },
};
export function StampBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.active;
  return (
    <span style={{ color: s.color, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}
export const forfaitBadgeStyle = () => ({
  color: COLORS.inkMuted, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
});
export function classifyAbonnement(a) {
  const todayStr = new Date().toISOString().split("T")[0];
  const statut = a.fields["Statut"];
  const statutSaysExpired = statut === "EXPIRÉ" || statut === "TERMINÉ";

  const nombre = a.fields["Nombre lavages"];
  const utilises = a.fields["Lavages utilisés"] || 0;
  const restantsField = a.fields["Lavages restants"];
  const restants =
    typeof restantsField === "number" ? restantsField
    : typeof nombre === "number" ? nombre - utilises
    : null;
  const noWashesLeft = restants !== null && restants <= 0;
  const fin = a.fields["Date fin"];
  const dateExpired = !fin || fin < todayStr;


  if (statutSaysExpired || dateExpired || noWashesLeft) return "expired";

  const finDate = new Date(fin);
  const nowDate = new Date(todayStr);
  const daysLeft = Math.round((finDate - nowDate) / (24 * 60 * 60 * 1000));
  if (daysLeft <= 7) return "expiring";

  return "active";
}
export const isAbonnementValidForWash = (a) => classifyAbonnement(a) !== "expired";

export const pctChange = (curr, prev) => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
};

export const TrendBadge = ({ pct }) => {
  const up = pct >= 0;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: up ? COLORS.green : COLORS.red }}>
      {up ? "+" : ""}{pct}%
    </span>
  );
};

export function MiniStatCard({ icon, label, value, trendPct, trendLabel }) {
  return (
    <div style={cardStyle({ padding: "16px 18px", flex: "1 1 180px", minWidth: 170 })}>
      <div style={{ fontSize: 13, color: COLORS.inkMuted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.ink, lineHeight: 1 }}>{value}</div>
      {trendPct !== undefined && (
        <div style={{ marginTop: 8 }}>
          <TrendBadge pct={trendPct} /> <span style={{ fontSize: 12, color: COLORS.inkMuted }}>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

export function TopBar({ search, setSearch, placeholder, onExport }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: 8, background: "#fff", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px" }}>
        <span style={{ color: COLORS.inkMuted, display: "flex" }}><SearchIcon /></span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder}
          style={{ border: "none", outline: "none", fontSize: 14, color: COLORS.ink, width: "100%", background: "transparent", fontFamily: "inherit" }} />
      </div>
      {onExport && (
        <button onClick={onExport} style={buttonStyle("ghost")}>
          <DownloadIcon /> Exporter
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, setPage, totalItems, pageSize }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  let pages = [];
  if (totalPages <= 7) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    pages = [1];
    if (page > 3) pages.push("…");
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
      <div style={{ fontSize: 13, color: COLORS.inkMuted }}>
        {start}–{end} sur {totalItems}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
          style={pageBtnStyle(false, page === 1)}><ChevronLeftIcon /></button>
        {pages.map((p, i) => p === "…" ? (
          <span key={`e${i}`} style={{ padding: "0 6px", color: COLORS.inkMuted, fontSize: 13 }}>…</span>
        ) : (
          <button key={p} onClick={() => setPage(p)} style={pageBtnStyle(p === page, false)}>{p}</button>
        ))}
        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
          style={pageBtnStyle(false, page === totalPages)}><ChevronRightIcon /></button>
      </div>
    </div>
  );
}
export const pageBtnStyle = (active, disabled) => ({
  minWidth: 28, height: 28, borderRadius: 6, border: `1px solid ${active ? COLORS.navy : COLORS.border}`,
  background: active ? COLORS.navy : "#fff", color: active ? "#fff" : disabled ? "#d1d5db" : COLORS.ink,
  fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
});

export function Toast({ message, type = "success" }) {
  if (!message) return null;
  const color = type === "error" ? COLORS.red : COLORS.green;
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      background: "#fff", border: `1px solid ${COLORS.border}`, borderLeft: `4px solid ${color}`,
      borderRadius: 8, padding: "10px 18px", fontSize: 14, color: COLORS.ink, fontWeight: 500,
      boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 1000, maxWidth: "90vw", textAlign: "center",
    }}>
      {message}
    </div>
  );
}
const escapeCSVFormula = (v) => {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

export function downloadCSV(filename, rows, headers) {
  const esc = (v) => `"${escapeCSVFormula(v).replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}