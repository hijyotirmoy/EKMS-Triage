# Developer API Documentation
## Project: EKMS Clinical Triage & Care Coordination Platform
**Base URL**: `http://localhost:3000/api` (Local) / `https://<production-domain>/api`  
**Data Format**: JSON (`application/json`)  
**Document Version**: 2.0  

---

## 1. Clinical Intelligence Endpoints

### 1.1 `POST /api/triage`
Evaluates reported symptoms, vitals, red flags, and caller coordinates to compute clinical urgency (1–10 score), action directives, and ranked proximity healthcare facilities.

#### Request Body
```json
{
  "complaint": "Acute severe fever and shivering with body ache",
  "age": 38,
  "sex": "Male",
  "duration": "2-3 days",
  "pincode": "781006",
  "district": "Kamrup Metro",
  "latitude": 26.1415,
  "longitude": 91.7905,
  "red_flags": ["High persistent fever > 102F"],
  "chronic_conditions": ["Diabetes"],
  "caller_preferred_destination": "ESIC Hospital"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "triage": {
    "urgency_level": "Urgent",
    "severity_score": 6,
    "confidence": 0.94,
    "clinical_summary_en": "Patient presents with high-grade fever and rigors with chronic diabetic vulnerability.",
    "clinical_summary_hi": "Rogi ko tez bukhar aur thand lagne ke lakshan hain.",
    "call_referral_primary": "ESIC Hospital",
    "directives": [
      {
        "id": "ESIC_HOSPITAL",
        "title": "ESIC Hospital (24x7 Casualty & OPD)",
        "priority": "Primary",
        "action": "Direct IP to 24x7 Casualty or General Medicine OPD"
      }
    ],
    "red_flags_identified": ["High persistent fever > 102F"],
    "nearby_facilities": [
      {
        "id": "fac_01",
        "name": "ESIC Hospital, Beltola",
        "facility_type": "Hospital",
        "district": "Kamrup Metro",
        "pincode": "781028",
        "distance_km": 3.4,
        "is_hospital": true,
        "is_dispensary": false
      }
    ]
  }
}
```

---

### 1.2 `POST /api/ekms-ai/chat`
Conversational clinical reasoning endpoint. Interactively queries the caller for clarifications with structured multi-select options and cumulative condition retention.

#### Request Body
```json
{
  "messages": [
    { "role": "user", "content": "I have been having fever and nausea" }
  ],
  "sessionContext": {
    "callerName": "Vikash",
    "age": "38",
    "sex": "Male",
    "location": "Dispur, Guwahati",
    "accumulatedConditions": ["Fever", "Nausea"]
  }
}
```

#### Response (`200 OK`)
```json
{
  "reply": "Since when have you been having high fever, and are you also experiencing any dizziness or neck stiffness?",
  "options": [
    "Fever started today with mild chills",
    "Persistent high fever > 3 days",
    "Experiencing dizziness and nausea",
    "No neck stiffness or breathing trouble",
    "Want to visit ESIC Hospital Casualty directly"
  ],
  "isTriageReady": false,
  "detectedEmergency": false
}
```

---

## 2. Facility Directory Endpoints

### 2.1 `GET /api/facilities`
Fetches operational facilities from server memory (0ms read). Supports text search, district, and facility type filters.

#### Query Parameters
- `q` *(optional)*: Free-text search on name, address, block, pincode, or site code.
- `district` *(optional)*: District name (e.g., `Kamrup Metro`, `Dibrugarh`) or `all`.
- `facility_type` *(optional)*: `Hospital`, `Dispensary`, `Tie-Up Hospital`, or `all`.

#### Response (`200 OK`)
```json
[
  {
    "id": "esis_dispur",
    "name": "ESIS Dispensary, Dispur",
    "facility_type": "Dispensary",
    "district": "Kamrup Metro",
    "pincode": "781006",
    "address": "Super Market, Dispur, Guwahati",
    "phone": "03612261000",
    "latitude": 26.1415,
    "longitude": 91.7905
  }
]
```

---

### 2.2 `DELETE /api/facilities`
Deletes one or multiple facilities by ID, updating server memory and Firestore simultaneously.

#### Request Body
```json
{
  "ids": ["esis_dispur", "esis_panbazar"]
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "deleted": 2,
  "message": "Successfully deleted 2 facilities"
}
```

---

### 2.3 `POST /api/facilities/import`
Accepts `multipart/form-data` containing `.xlsx`, `.xls`, or `.csv` facility spreadsheets and imports them in batch.

#### Form Field
- `file`: Spreadsheet file.

#### Response (`200 OK`)
```json
{
  "success": true,
  "imported": 18,
  "total_facilities": 18,
  "message": "Successfully imported 18 facilities"
}
```

---

## 3. Cases & Analytics Endpoints

### 3.1 `GET /api/cases`
Queries stored triage cases with optional filters for caller phone number, urgency, and text search.

### 3.2 `POST /api/cases`
Persists a new completed triage encounter, including clinical assessment, forwarded destination, and booked appointment token.

### 3.3 `GET /api/cases/stats`
Returns aggregated case metrics for the top header badges and CRM dashboard.

#### Response (`200 OK`)
```json
{
  "total": 142,
  "by_urgency": {
    "Emergency": 12,
    "Urgent": 38,
    "Routine": 74,
    "Self-care": 18
  },
  "forwarded_count": 89,
  "booked_count": 64
}
```

---

## 4. Metadata & Signaling Endpoints

### 4.1 `GET /api/meta`
Aggregates dynamic dropdown choices, operational facility counts, active model, and district lists.

#### Response (`200 OK`)
```json
{
  "districts": ["Cachar", "Dibrugarh", "Kamrup Metro", "Nagaon"],
  "pincodes": ["781001", "781006", "781028"],
  "facility_types": ["Dispensary", "ESIC Hospital", "Tie-Up Facility"],
  "facility_count": 18,
  "urgency_levels": ["Emergency", "Urgent", "Routine", "Self-care"],
  "model": "anthropic/claude-sonnet-4-6"
}
```

---

### 4.2 `GET /api/call/signal` & `POST /api/call/signal`
Coordinates WebRTC audio call signaling between caller clients and triage operator consoles.

#### Query Parameters
- `role`: `agent` or `caller`.
- `agentId`: Unique ID of the active agent.

---

## 5. Browser Cross-Tab Broadcast Events

The frontend coordinates state across open browser tabs using `new BroadcastChannel("ekms_sync_channel")`:

| Event Name | Payload | Trigger Condition & Effect |
|---|---|---|
| `FACILITIES_UPDATED` | `{}` | Fired when facilities are imported or deleted. All tabs reload metadata and directory without page refresh. |
| `NEW_CASE` | `{ case_ref, triage }` | Fired when a new case is completed. Updates total stats and urgency badge numbers in other tabs. |
| `DELETE_CASE` | `{ id }` | Fired when a case is deleted in CRM view. Decrements global case counter in memory. |
| `SYNC_STATS_TOTAL` | `{ total }` | Enforces exact synchronization of total case count. |
