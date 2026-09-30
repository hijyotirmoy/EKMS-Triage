# EKMS Triage Platform (ESIC / ESIS Assam)

An enterprise-grade emergency intake and clinical triage system with AI-assisted urgency evaluation, nearest facility proximity routing, high-availability multi-LLM architecture, cloud database persistence, and production deployment.

---

## 📚 Official System Documentation

- **Printable Operations & Architecture Manual (Recommended for Print / PDF)**: [`DOCUMENTATION.html`](./DOCUMENTATION.html) *(Open in any browser and press `Ctrl + P` to print or save as PDF)*
- **Technical Architecture Overview (Markdown)**: [`DOCUMENTATION.md`](./DOCUMENTATION.md)

---

## 🚀 Core Platform Features

- **Live Intake & Voice Speech Recognition**:
  - Live audio streaming & continuous speech-to-text recognition in Hinglish, Hindi, and English.
  - Automatic caller past encounter history lookup by phone number.
- **Clinical Triage Decision Engine**:
  - 4 standardized clinical urgency categories: 🚨 **Emergency (8-10)**, ⚠️ **Urgent (5-7)**, 📋 **Routine (3-4)**, 🌿 **Self-care (1-2)**.
  - Bilingual summary generation (English & Hindi) with red-flag symptom extraction.
  - Immediate emergency routing protocol for **108 Ambulance Dispatch** and **104 Tele-Doctor Consultation**.
- **Enterprise Multi-LLM Reasoning Engine**:
  - Distributed multi-channel request routing with automatic dynamic failover.
  - Sub-second clinical assessment latency (450ms – 900ms).
  - Deterministic reliability guaranteeing valid clinical evaluations.
- **Facility Directory & Proximity Engine**:
  - Authentic dataset of **98 ESIC hospitals, model dispensaries, and empanelled private tie-up facilities across 34 Assam districts**.
  - Real-time Haversine geodesic distance calculation.
  - **`Template`**: Download Excel (.xlsx) / CSV import templates.
  - **`Import`**: Bulk upload facility records.
  - **`Export`**: One-click download of all facility directory data in Excel (`.xlsx`).
- **Real-Time Cloud Synchronization**:
  - Centralized cloud persistence for facilities (98 records), cases, active operator sessions, and caller history.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS & Lucide React
- **Database**: Cloud Database Layer
- **LLM Reasoning**: Enterprise Multi-LLM Architecture
- **Spreadsheets**: SheetJS (`xlsx`) for Excel & CSV I/O
- **Hosting**: Netlify Production Pipeline

---

## 🏃 Quickstart

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```

3. Open **`http://localhost:3000`** in your browser.

---

## 🖨️ How to Print / Save as PDF

1. Open [`DOCUMENTATION.html`](./DOCUMENTATION.html) in Google Chrome or Microsoft Edge.
2. Click the **"🖨️ Print / Save as PDF"** button (or press `Ctrl + P`).
3. Select **Destination: Save as PDF** (or your printer).
4. Set **Layout: Portrait**, **Paper Size: A4**, and enable **Background graphics**.
5. Click **Save / Print**.
