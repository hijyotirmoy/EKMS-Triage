# EKMS Triage Sandbox (ESIC / ESIS Assam)

A full-stack Next.js triage system with AI-assisted urgency scoring, nearest ESIC / ESIS facility proximity routing, Firebase database persistence, and ready-to-deploy Netlify configuration.

---

## 🚀 Features

- **Exact User Interface & Design**:
  - Custom typography with *Bricolage Grotesque*, *IBM Plex Sans*, and *IBM Plex Mono*.
  - Identical light theme palette, gradient overlays, and animated badges (`pulse-emergency`, `rise`).
  - Emergency 108 direct-call header button.
- **4 Complete Application Tabs**:
  1. **Live Intake & Triage**:
     - 4 instant sample call presets: *Chest pain (Hinglish)*, *Fever + cough (Hindi)*, *Minor cut at work*, *Pesticide exposure*.
     - Intake fields: caller name, phone, age, sex, symptom notes, duration dropdown, 1-10 pain/severity slider, city, district, pincode, GPS coordinates.
     - Clinical output panel: Urgency Badge (Emergency, Urgent, Routine, Self-care), `CALL 108 NOW` banner, latency & confidence metrics, bilingual English and Hindi summaries, reasoning breakdown, red-flags alert box, recommended facility type, caller instructions, follow-up questions, and nearest facilities cards with distance (km) and one-click SMS address copy.
  2. **Case Logs**:
     - Real-time audit trail of all triaged calls.
     - Live search (by name, phone, or symptom notes) and urgency filter.
     - Expandable row details with clinical reasoning.
  3. **Facility Directory**:
     - Complete authentic dataset of all **36 ESIC & ESIS hospitals and dispensaries across 18 Assam districts**.
     - Search and filter by district and facility type.
     - One-click Google Maps turn-by-turn directions.
     - CSV bulk import button.
  4. **API & Playground**:
     - Complete API documentation with authentication (`X-API-Key`) and rate-limit details.
     - Live JSON request/response playground with latency counters.
     - One-click cURL snippet copying.
- **Database (Firebase & Local Fallback)**:
  - Supports Firebase Firestore for persistent storage of `cases` and `facilities`.
  - Zero-config local fallback enabled by default so the application runs immediately without requiring setup.
- **Hosting**:
  - Fully configured for Netlify deployment via `netlify.toml`.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Notifications**: Sonner (toasts)
- **Database**: Firebase / Firestore (with local fallback)
- **Deployment**: Netlify

---

## 🏃 Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Connecting Firebase

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Cloud Firestore** in your Firebase project.
3. Copy your Firebase credentials into `.env.local`:
   ```env
   # Web SDK Keys
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # Optional: Service Account for Server-side Admin SDK
   FIREBASE_CLIENT_EMAIL=your_service_account_email
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
   ```
4. Restart the app (`npm run dev` or `npm run build && npm start`). Cases and newly imported facilities will automatically persist to Firebase Firestore.

---

## 🌐 Deploying to Netlify

### Option 1: Netlify Git Integration (Recommended)
1. Push this repository to GitHub or GitLab.
2. In [Netlify Dashboard](https://app.netlify.com/):
   - Click **Add new site** -> **Import an existing project**.
   - Select your repository.
   - Netlify will automatically detect the settings in `netlify.toml`:
     - **Build command**: `npm run build`
     - **Publish directory**: `.next`
   - In **Environment Variables**, add any custom keys (e.g. `API_KEY`, Firebase keys).
   - Click **Deploy**.

### Option 2: Netlify CLI
```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

---

## 📡 API Reference

All endpoints except `GET /api/` require the `X-API-Key` header:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/` | Public health and liveness check |
| `GET` | `/api/meta` | Districts, pincodes, facility types, and duration options |
| `GET` | `/api/cases/stats` | Case counts aggregated by urgency |
| `GET` | `/api/cases` | List logged cases (supports `?urgency=` and `?q=`) |
| `GET` | `/api/cases/:case_ref` | Retrieve a single case by reference code |
| `GET` | `/api/facilities` | Directory search (supports `?q=`, `?district=`, `?facility_type=`) |
| `GET` | `/api/facilities/nearest` | Facility routing by `latitude`, `longitude`, or `pincode` |
| `POST` | `/api/facilities/import` | Bulk CSV import of facilities |
| `POST` | `/api/triage` | Submit caller intake, evaluate urgency, and rank nearest facilities |
