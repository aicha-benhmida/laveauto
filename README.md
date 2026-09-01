# LaveAuto

QR-code based car wash subscription management system. Staff scan a client's
QR code to check subscription status, log washes, and renew subscriptions.

## Stack

- **Frontend:** React + Vite (`src/`)
- **Backend:** Netlify serverless functions (`netlify/functions/`)
- **Database:** Airtable

## Project structure

```
netlify/functions/
  _auth.js       - signs/verifies session tokens
  login.js       - handles login, rate limiting
  airtable.js    - proxies all Airtable requests, requires valid session
src/
  main.jsx, App.jsx      - app entry point
  Login.jsx               - login screen
  Dashboard.jsx           - overview stats
  QRSearchApp.jsx         - QR scan/search, create/undo/renew washes
  AbonnementsPage.jsx     - subscriptions list
  ActiviteLavagesPage.jsx - wash activity log
  ClientHistory.jsx       - per-client history
  shared.jsx               - shared components/helpers
  airtable.js               - frontend API client
```

## Setup

```bash
npm install
```

Run locally:

```bash
netlify dev
```

(Plain `npm run dev` will NOT work — the app depends on
`netlify/functions/`, which only `netlify dev` serves locally.)

## Environment variables

| Variable | Description |
|---|---|
| `AIRTABLE_BASE_ID` | Airtable base ID |
| `AIRTABLE_TOKEN` | Airtable personal access token |
| `APP_USERNAME` | Login username |
| `APP_PASSWORD` | Login password |
| `APP_SESSION_SECRET` | Random secret used to sign session tokens |

Set these in Netlify under **Project configuration → Environment
variables** for production — never commit `.env`.

## Deploy

```bash
npm run build
netlify deploy --prod
```

Requires the project to be linked once with `netlify link`.

## Airtable tables

- **Clients** — Nom, Téléphone, Email
- **Véhicules** — Matriculation, Marque, Modèle, Client
- **Abonnements** — Client, Véhicule, QR Code, Forfait, Date début, Date fin, Nombre lavages, Lavages utilisés
- **Lavages** — Abonnement, Client, Véhicule, Date/heure
- **QR Codes** — Code, Status, Abonnement
