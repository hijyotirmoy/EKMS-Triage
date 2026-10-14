# Design & UI/UX Specifications
## Project: EKMS Clinical Triage & Care Coordination Platform
**System**: High-Speed Clinical Call-Center User Interface  
**Design Standard**: Healthcare Critical-Incident Ergonomics & Mission-Critical UI  
**Theme Engine**: Tailwind CSS v3 with Dark / Light Mode Support  

---

## 1. Design Philosophy & Core Principles

Emergency call operators and triage nurses operate under severe time constraints, high emotional stress, and complex multi-tasking (listening to a distressed caller while typing and reviewing medical maps).

The UI is designed around four inviolable principles:
1. **Zero Cognitive Friction**: Crucial clinical data (urgency tier, red flags, emergency ambulance trigger) must be immediately recognizable within 200 milliseconds of glance time.
2. **High-Contrast Clinical Palette**: Color is never purely decorative; it communicates life-safety state (Red = Emergency Ambulance, Amber = Urgent Clinic, Emerald = Routine Dispensary, Teal/Blue = Self-Care / Tele-Doctor).
3. **Data Sanitization by Default**: Missing or placeholder database fields (`NA`, `N/A`, `0`, `Approx 0 KM`, `Distance N/A`) are strictly suppressed so operators are never confused by bogus metrics.
4. **Keyboard-First Speed**: Primary workflows (submitting questions, selecting multi-option symptoms, confirming dispatches) support single-stroke or `Enter` key execution without mandatory mouse navigation.

---

## 2. Color System & Semantic Tokens

```
===================================================================================
TOKEN               HEX / CLASS             SEMANTIC USAGE
===================================================================================
Emergency / Red     #EF4444 (rose-500)      Score 8–10: 108 Ambulance Dispatch, Trauma
                    #991B1B (rose-800)      Cardiac Arrest, Heavy Bleeding, Shock
-----------------------------------------------------------------------------------
Urgent / Amber      #F59E0B (amber-500)     Score 5–7: Same-day ESIC Hospital OPD,
                    #92400E (amber-800)     Persistent high fever, severe acute pain
-----------------------------------------------------------------------------------
Routine / Emerald   #10B981 (emerald-500)   Score 3–4: ESIS Dispensary Primary Care,
                    #065F46 (emerald-800)   Mild symptoms, chronic medication refill
-----------------------------------------------------------------------------------
Self-Care / Blue    #3B82F6 (blue-500)      Score 1–2: 104 Tele-Doctor Helpline,
                    #1E40AF (blue-800)      Home advice, preventive wellness
-----------------------------------------------------------------------------------
Neutral Light       #F8FAFC (slate-50)      App background, panel separation
Neutral Dark        #0F172A (slate-900)      Dark mode background, card surface
Accent Brand        #2563EB (blue-600)      Primary CTAs, active tab pills, focus rings
===================================================================================
```

---

## 3. Layout Architecture: 3-Panel Ergonomic Grid

The triage console utilizes an ergonomic 3-column / 3-panel layout designed for 1080p and 720p call center workstations:

```
+-----------------------------------------------------------------------------------+
|  [EKMS Logo]  Assam ESIC Triage  ·  Triage Case (12)  ·  Triage Facility (18)      |
+--------------------------+------------------------------+-------------------------+
| PANEL 1: INTAKE & SCRIBE | PANEL 2: AI DOCTOR CHAT      | PANEL 3: TRIAGE RESULT  |
|                          |                              |                         |
| • Caller Demographics   | • Conversational dialogue    | • Urgency Badge (8-10)  |
| • Voice Speech Scribe    | • Non-repeating questions    | • Primary Directive     |
| • Chief Complaint Input  | • Multi-option check pills   | • Nearest Facilities    |
| • Red Flag Quick Toggles | • Enter key instant submit   | • Forward / Book Button |
| • Caller History Match   | • Multi-condition synthesis  | • Leaflet Assam Geo-Map |
+--------------------------+------------------------------+-------------------------+
```

---

## 4. Component-Level Design Specifications

### 4.1 AI Doctor Question & Multi-Select Option Pills (`DoctorChatWidget.jsx`)
- **Question Bubble**: Rendered with soft medical blue tint (`bg-blue-50/80 dark:bg-blue-950/40`), left accent bar, and clear typography.
- **Multi-Option Badges**:
  - Unselected: Crisp border, subtle background (`border-border/80 bg-secondary/50 text-foreground`).
  - Selected: High-contrast emerald or brand blue (`bg-primary text-primary-foreground font-bold shadow-xs`).
  - Supports selecting **two or more options** simultaneously before submitting.
- **Enter Key Action**: Pressing `Enter` in the text area or when options are selected immediately triggers assessment submission without requiring a mouse click.

### 4.2 Facility Card Sanitization & Display (`TriageResultPanel.jsx`)
- **Header Badge**: Displays facility classification (`ESIS Dispensary`, `ESIC Hospital`, or `Tie-Up Facility`).
- **Operating Hours Pill**:
  - Dispensaries: Marked with `OPD: Mon–Fri 10:00 AM – 4:00 PM` (or `Closed on Weekends` if Saturday afternoon/Sunday).
  - Hospitals: Marked with `Open · IPD & Casualty: 24x7`.
- **Distance Badge**:
  - Rendered **strictly** when `distance_km != null && Number(distance_km) > 0` as `Approx X.X KM`.
  - Never displays `"Approx 0 KM"` or `"Distance N/A"`.
- **Contact & Location Details**:
  - Phone numbers are rendered only if not equal to `"NA"`, `"N/A"`, or `"0"`.
  - District and PIN codes suppress `"NA"` placeholders.

### 4.3 Case Handover & Appointment Booking Modal (`CaseHandoverForwarding.jsx`)
- **Referral-Booking Lockstep Consistency**:
  - When clinical summary is forwarded to a specific facility, booking is locked with an emerald confirmation badge (`🔒 Facility Locked to Clinical Summary Dispatch`).
- **Dispensary Single Department Restriction**:
  - When the target facility is an **ESIS Dispensary**, the **OPD Department / Clinic** dropdown displays **only one option**:
    `General Medicine / Primary Care OPD`.
  - Tertiary specialty clinics (Diabetic, Pediatrics, Dental, OBG, Orthopedics, Casualty Observation) are rendered only when a Hospital is selected.
- **Appointment Receipt Card**:
  - Displays unique alphanumeric Token No, Beneficiary Name, Age/Sex, Chosen Time Slot, and facility address with print and export capabilities.

### 4.4 Interactive Map (`AssamMap.jsx`)
- **Map Engine**: Leaflet with custom OpenStreetMap / CartoDB tiles.
- **Marker Color Coding**:
  - Red pulsing pin = Caller incident location.
  - Emerald pin = Operational ESIS Dispensary.
  - Blue hospital pin = ESIC Hospital.
  - Purple pin = Tie-Up private multi-specialty center.
- **Sanitized Popups**: Suppresses empty or placeholder phone numbers, district, and distance fields.

---

## 5. Keyboard Navigation & Accessibility (A11y)

| Key Combination | Action Executed | Context |
|---|---|---|
| `Enter` | Submit selected multi-options or typed chat response | AI Doctor Chat Widget |
| `Escape` | Dismiss modal dialogs / cancel confirmation popup | Handover & Booking Modals |
| `Ctrl + P` | Print-formatted clean triage summary / appointment token | Handover Receipt View |
| `Tab` / `Shift + Tab` | Navigate sequentially through intake fields | Manual Intake Panel |

---

## 6. Responsive Breakpoint Matrix

- **1920x1080 (Desktop / Workstation)**: Full 3-column expanded layout with simultaneous map and chat view.
- **1366x768 (Standard Call Center Monitor)**: 3-column compact layout with collapsible map drawer.
- **1024x768 (Tablet / Secondary Display)**: 2-column layout (Intake & Chat in Column 1, Results & Handover in Column 2).
- **< 768px (Mobile Dispatch)**: Single-column tabbed layout (Intake $\rightarrow$ Assessment $\rightarrow$ Routing).
