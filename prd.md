# Product Requirements Document (PRD)
## Project: EKMS Clinical Triage & Care Coordination Platform
**Target Organization**: ESIC / ESIS Care Coordination Centre, Assam  
**Document Version**: 2.0  
**Status**: Active Production  
**Last Updated**: October 2026  

---

## 1. Executive Summary & Vision

The **EKMS (Emergency & Knowledge Management System) Triage Platform** is an enterprise-grade clinical decision support and patient navigation system designed for medical dispatchers, call operators, and triage nurses coordinating care for Insured Persons (IPs) across Assam.

The platform bridges caller distress and actual Assam healthcare infrastructure by providing:
1. **Interactive Conversational Clinical Assessment**: An AI-powered virtual medical officer asking precise clarifying questions with multi-option responses.
2. **Deterministic Urgency Scoring (1–10)**: Categorizing callers into Emergency (108 Ambulance), Urgent (Hospital/Dispensary OPD), Routine (Scheduled Dispensary), or Self-Care (104 Helpline).
3. **Geodesic & Road Proximity Routing**: Real-time Haversine and road distance calculation matching callers with operational ESIS Dispensaries, ESIC Hospitals, and Tie-Up Super-specialty Centers.
4. **End-to-End Case Handover & OPD Booking**: Synchronized clinical summary forwarding, unified reference code generation, and appointment booking with referral consistency enforcement.

---

## 2. Target User Personas

| Persona | Role | Key Needs & Pain Points | Primary Features Used |
|---|---|---|---|
| **Emergency Triage Operator** | Frontline 104/108 call-taker in Guwahati | Needs sub-second clinical decisions, instant red-flag recognition, and quick-click inputs while on a live audio call. | Voice Scribe, Fast Checkboxes, Multi-select question replies, 108 Emergency Override. |
| **Medical Officer (Tele-Doctor)** | Senior MBBS reviewing high-risk cases | Needs bilingual summary (English/Hinglish), chief complaint history, past encounters, and vitals. | Detailed Clinical Summary, CRM Beneficiary Timeline, Red Flags Badge. |
| **Care Coordinator / Referral Desk** | Hospital administrator managing IP referrals | Needs formal dispatch reference codes, appointment tokens, and SMS notification logs. | Case Handover & Forwarding Panel, OPD Token Generator, Printable Receipt. |
| **Insured Person (Beneficiary)** | Worker or family member seeking treatment | Often speaks Hinglish/Assamese, confused between Dispensary and Hospital, needs nearest center and directions. | Clear bilingual SMS confirmation, Google Maps directions, OPD operating hours. |

---

## 3. Core Functional Requirements

### 3.1 Voice & Manual Scribe Intake
- **Real-Time Speech-to-Text**: Continuous browser speech recognition with language toggling (English, Hindi/Hinglish).
- **Demographic Extraction**: Captures Name, Age, Sex, Phone (+91), IP Insurance Number, District, and PIN Code.
- **Encounter Pre-Population**: Immediate lookup matching phone number against past call records and previous triage assessments.

### 3.2 Conversational AI Doctor & Questioning Engine
- **Non-Repeating Dynamic Questions**: Questions must never repeat even when API limits or network retries occur.
- **Multi-Option Selection**: Clarifying medical questions provide structured clickable options where operators can select one, two, or multiple answers simultaneously.
- **Enter Key Submission**: Typing or checking an answer and pressing `Enter` submits immediately without touching the mouse.
- **Multi-Condition Memory & Fusion**: When a caller introduces a second symptom (e.g., initially reported *"Fever and chills"*, then later adds *"Severe leg pain from injury"*), the reasoning engine retains both conditions, merges them without duplicate phrasing, and evaluates the cumulative clinical picture.
- **Beneficiary Hospital Preference Prioritization**: If the beneficiary explicitly states or clicks that they want to go to a Hospital or Casualty, the system strictly respects their intent and routes to **ESIC Hospital** instead of defaulting to a dispensary.

### 3.3 Clinical Urgency Tiers & Protocols
- **Score 8–10 (Emergency)**: Immediate mobilization of **108 Ambulance Dispatch**. Triggered by head trauma, deep lacerations/bleeding, workplace machinery injuries, chest pain with radiation, breathing distress, or severe cases in callers aged > 50.
- **Score 5–7 (Urgent)**: Same-day evaluation at ESIC Hospital 24x7 Casualty or operational ESIS Dispensary.
- **Score 3–4 (Routine)**: Scheduled visit to registered ESIS Dispensary during regular OPD hours.
- **Score 1–2 (Self-Care)**: Home management guidance and handover to **104 Health Helpline Tele-Doctor**.

### 3.4 Geodesic Facility Directory & Proximity Matching
- **Zero Hardcoded Seeds**: System starts cleanly with active records; deleting all facilities results in 0 count (`0 of 0 facilities found`).
- **Data Sanitization**: Suppresses placeholder text like `"NA"`, `"N/A"`, `"0"`, `"Distance N/A"`, or `"Approx 0 KM"` across all cards and map markers.
- **Road Distance Estimation**: Straight-line Haversine distance scaled by Assam terrain road factors to compute accurate travel estimates.
- **Multi-Category Filter**: Filter by Kamrup Metro, Dibrugarh, Cachar, etc., and type (Dispensary, ESIC Hospital, Tie-Up Facility).

### 3.5 Facility Handover & Appointment Booking
- **Referral-Booking Lockstep Enforcement**:
  - If a case summary is forwarded to Facility A, appointment booking is strictly locked to Facility A.
  - If an appointment is booked at Facility B, summary forwarding is strictly locked to Facility B.
- **Dispensary Single Department Rule**:
  - When booking an appointment at an **ESIS Dispensary**, the department dropdown shows **only one department**: `General Medicine / Primary Care OPD`.
  - Specialty clinics (Diabetic, Pediatrics, Dental, OBG, Orthopedics, Emergency Observation) are available only at tertiary **Hospitals**.
- **Unified Reference Code**: Generates standard alphanumeric reference IDs (e.g., `ESIC-DISP-261014-XXXX` or `108-EMERG-XXXX`).

---

## 4. Non-Functional Requirements (NFRs)

| Metric | Requirement | Strategy |
|---|---|---|
| **Latency** | Triage response in < 800ms; facility lookups in 0ms | In-memory memoryFacilities, client-side localStorage cache. |
| **Availability** | 99.9% uptime during call center shifts | Multi-LLM failover to deterministic heuristic engine. |
| **Scalability** | Support 50+ concurrent agents without database quota spikes | Zero-read server memory pattern; read-through Firestore caching. |
| **Data Integrity** | Cross-tab synchronization without reload | Native `BroadcastChannel` (`broadcastSync.js`). |
| **Mobile & Desktop** | Responsive across 1366x768 call center monitors and tablets | CSS Grid / Flexbox layout with touch & keyboard shortcuts. |

---

## 5. Success Metrics & Key Performance Indicators (KPIs)

1. **Intake to Dispatch Time**: Reduce average emergency call handling time from 4.5 minutes to under **90 seconds**.
2. **Referral Accuracy**: 100% adherence to 108 emergency dispatch for critical trauma/accidents.
3. **Zero-Read Quota Efficiency**: 95% reduction in daily Firestore read operations.
4. **Referral Consistency**: 0% mismatched referrals between clinical forwarding and OPD appointments.
