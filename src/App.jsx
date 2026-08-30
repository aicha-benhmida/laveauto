import { useEffect, useState } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";
import ActiviteLavagesPage from "./ActiviteLavagesPage";
import AbonnementsPage from "./AbonnementsPage";
import ClientHistory from "./ClientHistory";
import QRSearchApp from "./QRSearchApp";
import { COLORS, useGarageFonts } from "./shared";
import { getToken } from "./airtable";

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState("qr");
  const [qrAction, setQrAction] = useState(null);

  useGarageFonts();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollLeft = 0;
  }, [authed]);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const tabs = [
    { key: "qr", label: "QR Code" },
    { key: "client", label: "Client" },
    { key: "dashboard", label: "Tableau de bord" },
    { key: "lavages", label: "Activité lavages" },
    { key: "abonnements", label: "Abonnements" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: COLORS.paper, fontFamily: "Inter, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 0" }}>
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
          <img src="/logo.png" alt="" style={{ height: 72, width: 72, borderRadius: "50%" }} />
          <span style={{ fontWeight: 700, fontSize: 26, color: COLORS.ink }}>Station LaveAuto</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap", borderBottom: `1px solid ${COLORS.border}` }}>
          {tabs.map((t) => (
            <TabButton key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</TabButton>
          ))}
        </div>
      </div>
      {tab === "qr" ? (
        <QRSearchApp
          pendingAction={qrAction}
          onActionHandled={() => setQrAction(null)}
          onViewAllLavages={() => setTab("lavages")}
        />
      ) : tab === "client" ? (
        <ClientHistory />
      ) : tab === "dashboard" ? (
        <Dashboard
          onScanQR={() => { setTab("qr"); setQrAction("scan"); }}
          onNewSubscription={() => { setTab("qr"); setQrAction("new"); }}
          onViewAllLavages={() => setTab("lavages")}
          onViewAllAbonnements={() => setTab("abonnements")}
        />
      ) : tab === "lavages" ? (
        <ActiviteLavagesPage />
      ) : (
        <AbonnementsPage />
      )}
    </div>
  );
}

const TabButton = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{
    padding: "8px 12px", cursor: "pointer", background: "transparent",
    color: active ? COLORS.ink : COLORS.inkMuted,
    border: "none", borderBottom: active ? `2px solid ${COLORS.ink}` : "2px solid transparent",
    fontWeight: active ? 600 : 500, fontSize: 13, fontFamily: "inherit", whiteSpace: "nowrap",
    marginBottom: -1,
  }}>
    {children}
  </button>
);