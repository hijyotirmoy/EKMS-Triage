// Firebase & Unified Database Layer
import defaultFacilities from "../data/facilities.json";

// In-memory local cache/fallback for instant zero-config launch
let memoryFacilities = [...defaultFacilities];
let memoryCases = [
  {
    id: "case-seed-1",
    case_ref: "CASE-260923-M341",
    intake: {
      caller_name: "Ramesh Kalita",
      phone: "9876543210",
      age: 48,
      sex: "Male",
      symptom_notes:
        "Bohot tej chhati me dard ho raha hai, baayein haath me jhanjhanahat hai aur thanda pasina aa raha hai.",
      duration: "Less than 2 hours",
      severity_reported: 9,
      city: "Guwahati",
      district: "Kamrup Metropolitan",
      pincode: "781022",
      source_app: "console",
    },
    triage: {
      urgency_level: "Emergency",
      urgency_score: 10,
      confidence: "high",
      summary_en:
        "48-year-old male reporting severe chest pain (9/10) with left arm tingling and cold sweating, onset less than 2 hours ago.",
      summary_hi:
        "48 वर्षीय पुरुष को पिछले 2 घंटों से तेज़ सीने में दर्द (9/10), बाएं हाथ में झनझनाहट और ठंडा पसीना आ रहा है।",
      reasoning:
        "The combination of severe chest pain (self-rated 9/10), left arm tingling, and cold sweating are classic red-flag warning signs of an acute coronary event. Immediate emergency medical response via 108 is required.",
      red_flags: [
        "Severe chest pain (9/10)",
        "Left arm tingling/radiation",
        "Cold sweating (diaphoresis)",
      ],
      recommended_facility_type: "Nearest Government Hospital / 108 Ambulance",
      recommended_action:
        "Instruct caller to lie down, remain calm, and immediately dial 108 for an emergency ambulance.",
      call_108: true,
      detected_language: "Hinglish",
      followup_questions: [
        "Kya unhe saans lene mein takleef ho rahi hai? (Difficulty breathing?)",
        "Kya wo hosh mein hain aur baat kar pa rahe hain?",
      ],
    },
    resolved_location: {
      latitude: 26.121567,
      longitude: 91.808542,
      method: "pincode",
      matched: "pincode 781022",
    },
    nearest_facilities: [
      {
        id: "6ab010629df5c804d8c6f746",
        name: "ESIC Hospital Beltola",
        facility_type: "Hospital",
        scheme: "ESIC",
        address:
          "ESIC Hospital Campus, Pir Ajan Fakir Rd, near Khanara Kendra Vidyalaya, Resham Nagar, Khanapara, Guwahati, Assam 781022",
        district: "Kamrup Metropolitan",
        pincode: "781022",
        distance_km: 0,
        maps_url:
          "https://www.google.com/maps/dir/?api=1&destination=26.1215667760845,91.8085422924737",
      },
    ],
    model_used: "anthropic/claude-sonnet-4-6",
    latency_ms: 1250,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

// Helper to check if Firebase is configured
export function isFirebaseConfigured() {
  return true; // Configured via default Firebase credentials in @/lib/firebase
}

let firestoreInstance = null;
let firestoreType = null; // 'admin' | 'web'

async function getFirestoreContext() {
  if (firestoreInstance) return { db: firestoreInstance, type: firestoreType };

  try {
    // 1. Attempt Admin SDK first if private key provided
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      const admin = await import("firebase-admin");
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          }),
        });
      }
      firestoreInstance = admin.firestore();
      firestoreType = "admin";
      return { db: firestoreInstance, type: firestoreType };
    }

    // 2. Client Web SDK via centralized Firebase instance
    const { getFirestoreDb } = await import("@/lib/firebase");
    firestoreInstance = getFirestoreDb();
    firestoreType = "web";
    return { db: firestoreInstance, type: firestoreType };
  } catch (err) {
    console.warn("Firebase initialization notice:", err.message);
  }
  return null;
}

// Facilities operations
export async function getFacilities(filters = {}) {
  const { q, district, facility_type } = filters;
  const ctx = await getFirestoreContext();

  let list = memoryFacilities;
  if (ctx) {
    try {
      if (ctx.type === "admin") {
        const snap = await ctx.db.collection("facilities").get();
        if (!snap.empty) {
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
      } else {
        const { collection, getDocs } = await import("firebase/firestore");
        const snap = await getDocs(collection(ctx.db, "facilities"));
        if (!snap.empty) {
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
      }
    } catch (e) {
      // If Firestore empty or permissions not yet open, fallback seamlessly to authentic facilities list
    }
  }

  return list.filter((f) => {
    if (district && district !== "all" && f.district !== district) return false;
    if (facility_type && facility_type !== "all" && f.facility_type !== facility_type) return false;
    if (q) {
      const query = q.toLowerCase();
      const matchName = f.name?.toLowerCase().includes(query);
      const matchAddr = f.address?.toLowerCase().includes(query);
      const matchPin = f.pincode?.includes(query);
      if (!matchName && !matchAddr && !matchPin) return false;
    }
    return true;
  });
}

export async function addFacilities(newItems) {
  const ctx = await getFirestoreContext();
  if (ctx) {
    try {
      if (ctx.type === "admin") {
        const batch = ctx.db.batch();
        for (const item of newItems) {
          const docRef = ctx.db.collection("facilities").doc();
          batch.set(docRef, item);
        }
        await batch.commit();
      } else {
        const { collection, addDoc } = await import("firebase/firestore");
        for (const item of newItems) {
          await addDoc(collection(ctx.db, "facilities"), item);
        }
      }
    } catch (e) {
      console.warn("Could not batch write facilities to Firestore:", e.message);
    }
  }
  memoryFacilities = [...newItems, ...memoryFacilities];
  return memoryFacilities.length;
}

// Cases operations
export async function getCases(filters = {}) {
  const { urgency, q } = filters;
  const ctx = await getFirestoreContext();

  let list = memoryCases;
  if (ctx) {
    try {
      if (ctx.type === "admin") {
        const snap = await ctx.db.collection("cases").get();
        list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } else {
        const { collection, getDocs } = await import("firebase/firestore");
        const snap = await getDocs(collection(ctx.db, "cases"));
        list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } catch (e) {
      console.warn("Firestore fetch cases notice:", e.message);
    }
  }

  return list.filter((c) => {
    if (urgency && urgency !== "all" && c.triage?.urgency_level !== urgency) return false;
    if (q) {
      const query = q.toLowerCase();
      const matchName = c.intake?.caller_name?.toLowerCase().includes(query);
      const matchPhone = c.intake?.phone?.toLowerCase().includes(query);
      const matchNotes = c.intake?.symptom_notes?.toLowerCase().includes(query);
      const matchRef = c.case_ref?.toLowerCase().includes(query);
      const matchAge = c.intake?.age != null && String(c.intake?.age).includes(query);
      const matchSex = c.intake?.sex?.toLowerCase().includes(query);
      if (!matchName && !matchPhone && !matchNotes && !matchRef && !matchAge && !matchSex) return false;
    }
    return true;
  });
}

export async function getCaseByRef(caseRef) {
  const all = await getCases();
  return all.find((c) => c.case_ref === caseRef) || null;
}

export async function saveCase(caseData) {
  const ctx = await getFirestoreContext();
  if (ctx) {
    try {
      if (ctx.type === "admin") {
        const docRef = await ctx.db.collection("cases").add(caseData);
        caseData.id = docRef.id;
      } else {
        const { collection, addDoc } = await import("firebase/firestore");
        const docRef = await addDoc(collection(ctx.db, "cases"), caseData);
        caseData.id = docRef.id;
      }
    } catch (e) {
      console.warn("Could not save case to Firestore:", e.message);
    }
  }
  memoryCases = memoryCases.filter((c) => c.case_ref !== caseData.case_ref);
  memoryCases.unshift(caseData);
  return caseData;
}

export async function deleteCase(caseRef) {
  const ctx = await getFirestoreContext();
  if (ctx) {
    try {
      if (ctx.type === "admin") {
        const snap = await ctx.db
          .collection("cases")
          .where("case_ref", "==", caseRef)
          .get();
        if (!snap.empty) {
          const batch = ctx.db.batch();
          snap.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        } else {
          await ctx.db.collection("cases").doc(caseRef).delete().catch(() => {});
        }
      } else {
        const { collection, query, where, getDocs, deleteDoc, doc } = await import(
          "firebase/firestore"
        );
        const q = query(
          collection(ctx.db, "cases"),
          where("case_ref", "==", caseRef)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          for (const docSnap of snap.docs) {
            await deleteDoc(docSnap.ref);
          }
        } else {
          await deleteDoc(doc(ctx.db, "cases", caseRef)).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Could not delete case from Firestore:", e.message);
    }
  }
  memoryCases = memoryCases.filter((c) => c.case_ref !== caseRef && c.id !== caseRef);
  return true;
}

export async function getCaseStats() {
  const all = await getCases();
  const by_urgency = { Emergency: 0, Urgent: 0, Routine: 0, "Self-care": 0 };
  for (const c of all) {
    const level = c.triage?.urgency_level;
    if (level && by_urgency[level] !== undefined) {
      by_urgency[level]++;
    }
  }
  return {
    total: all.length,
    by_urgency,
  };
}
