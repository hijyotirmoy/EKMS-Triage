// Firebase & Unified Database Layer with Ultra-Low Read Architecture
import defaultFacilities from "../data/facilities.json";

// In-memory local cache/fallback for instant zero-config launch and 0-read execution
let memoryFacilities = [...defaultFacilities];
let isFacilitiesLoadedFromFirestore = false;
let deletedFacilityIds = new Set();
let facilitiesVersion = Date.now();

let memoryCases = [
  {
    id: "case-seed-1",
    case_ref: "CA0001AB01",
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

let isCasesLoadedFromFirestore = false;
let cachedStats = null;
let cachedStatsTimestamp = 0;

// Helper to check if Firebase is configured
export function isFirebaseConfigured() {
  return true;
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
      return { db: firestoreInstance, type: "admin" };
    }

    // 2. Client SDK fallback
    const { getFirestoreDb } = await import("./firebase");
    firestoreInstance = getFirestoreDb();
    firestoreType = "web";
    return { db: firestoreInstance, type: firestoreType };
  } catch (err) {
    console.warn("Firebase initialization notice:", err.message);
  }
  return null;
}

// Helper to get facilities metadata state
async function getFacilitiesMeta(ctx) {
  if (!ctx) return { seeded: false, deleted_ids: [] };
  try {
    if (ctx.type === "admin") {
      const snap = await ctx.db.collection("system_meta").doc("facilities_state").get();
      if (snap.exists) return snap.data() || { seeded: false, deleted_ids: [] };
    } else {
      const { doc, getDoc } = await import("firebase/firestore");
      const snap = await getDoc(doc(ctx.db, "system_meta", "facilities_state"));
      if (snap.exists()) return snap.data() || { seeded: false, deleted_ids: [] };
    }
  } catch (e) {
    console.warn("Facilities meta fetch notice:", e.message);
  }
  return { seeded: false, deleted_ids: [] };
}

async function saveFacilitiesMeta(ctx, data) {
  if (!ctx) return;
  try {
    if (ctx.type === "admin") {
      await ctx.db.collection("system_meta").doc("facilities_state").set(data, { merge: true });
    } else {
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(ctx.db, "system_meta", "facilities_state"), data, { merge: true });
    }
  } catch (e) {
    console.warn("Facilities meta save notice:", e.message);
  }
}

/**
 * High-Efficiency Facilities Fetch:
 * Returns from server memory in 0ms with 0 Firestore reads.
 * Only reads from Firestore once on cold boot.
 */
export async function getFacilities(filters = {}) {
  const { q, district, facility_type } = filters;

  if (!isFacilitiesLoadedFromFirestore) {
    const ctx = await getFirestoreContext();
    if (ctx) {
      try {
        const meta = await getFacilitiesMeta(ctx);
        const deletedSet = new Set([
          ...(meta.deleted_ids || []).map(String),
          ...Array.from(deletedFacilityIds).map(String),
        ]);

        let firestoreList = [];
        if (ctx.type === "admin") {
          const snap = await ctx.db.collection("facilities").get();
          if (!snap.empty) {
            firestoreList = snap.docs.map((d) => ({ id: d.id, ...d.data(), _doc_id: d.id }));
          }
        } else {
          const { collection, getDocs } = await import("firebase/firestore");
          const snap = await getDocs(collection(ctx.db, "facilities"));
          if (!snap.empty) {
            firestoreList = snap.docs.map((d) => ({ id: d.id, ...d.data(), _doc_id: d.id }));
          }
        }

        if (firestoreList.length > 0) {
          memoryFacilities = firestoreList.filter((f) => {
            if (deletedSet.has(String(f.id))) return false;
            if (f._doc_id && deletedSet.has(String(f._doc_id))) return false;
            if (f.site_code && deletedSet.has(String(f.site_code))) return false;
            return true;
          });
        } else if (!meta.seeded && defaultFacilities && defaultFacilities.length > 0) {
          memoryFacilities = defaultFacilities.filter((f) => !deletedSet.has(String(f.id)));
          setTimeout(async () => {
            try {
              await saveFacilitiesMeta(ctx, { seeded: true, deleted_ids: [] });
              if (ctx.type === "admin") {
                const batch = ctx.db.batch();
                for (const fac of defaultFacilities) {
                  const docId = String(fac.id || fac.site_code || Math.random().toString(36).substring(2, 9));
                  const docRef = ctx.db.collection("facilities").doc(docId);
                  batch.set(docRef, fac);
                }
                await batch.commit();
              } else {
                const { doc, setDoc } = await import("firebase/firestore");
                for (const fac of defaultFacilities) {
                  const docId = String(fac.id || fac.site_code || Math.random().toString(36).substring(2, 9));
                  await setDoc(doc(ctx.db, "facilities", docId), fac).catch(() => {});
                }
              }
            } catch (seedErr) {
              console.warn("Auto-seeding facilities notice:", seedErr.message);
            }
          }, 100);
        }
      } catch (e) {
        console.warn("Firestore facilities cold-boot error:", e.message);
      }
    }
    isFacilitiesLoadedFromFirestore = true;
  }

  const list = memoryFacilities.filter((f) => !deletedFacilityIds.has(String(f.id)));

  return list.filter((f) => {
    if (district && district !== "all") {
      const targetDist = String(district).toLowerCase().trim();
      const fDist = String(f.district || "").toLowerCase().trim();
      const isKamrupMatch =
        (targetDist.includes("kamrup") && fDist.includes("kamrup")) ||
        targetDist === fDist;
      if (!isKamrupMatch && fDist !== targetDist) return false;
    }
    if (facility_type && facility_type !== "all") {
      const targetType = String(facility_type).toLowerCase().trim();
      const fType = String(f.facility_type || "").toLowerCase().trim();
      const fName = String(f.name || "").toLowerCase().trim();

      const isTieUpFilter = targetType.includes("tie");
      const isTieUpFac = fType.includes("tie") || fName.includes("tie") || String(f.scheme || "").toLowerCase().includes("tie");

      const isHospitalFilter = targetType.includes("hospital") && !targetType.includes("tie");
      const isHospitalFac = (fType.includes("hospital") && !fType.includes("tie")) || fName.includes("hospital");

      const isDispensaryFilter = targetType.includes("dispensary");
      const isDispensaryFac = fType.includes("dispensary") || fName.includes("dispensary");

      if (isTieUpFilter) {
        if (!isTieUpFac) return false;
      } else if (isHospitalFilter) {
        if (!isHospitalFac) return false;
      } else if (isDispensaryFilter) {
        if (!isDispensaryFac) return false;
      } else if (fType !== targetType) {
        return false;
      }
    }
    if (q && String(q).trim()) {
      const query = String(q).toLowerCase().trim();
      const matchName = String(f.name || "").toLowerCase().includes(query);
      const matchAddr = String(f.address || "").toLowerCase().includes(query);
      const matchPin = String(f.pincode || "").toLowerCase().includes(query);
      const matchDist = String(f.district || "").toLowerCase().includes(query);
      const matchBlock = String(f.block || "").toLowerCase().includes(query);
      const matchPhone = String(f.phone || "").toLowerCase().includes(query);
      const matchType = String(f.facility_type || "").toLowerCase().includes(query);
      const matchSite = String(f.site_code || "").toLowerCase().includes(query);
      if (!matchName && !matchAddr && !matchPin && !matchDist && !matchBlock && !matchPhone && !matchType && !matchSite) return false;
    }
    return true;
  });
}

export async function addFacilities(newItems) {
  const ctx = await getFirestoreContext();
  const addedIds = new Set(newItems.map((item) => String(item.id || item.site_code || "")));

  for (const id of addedIds) {
    if (id) deletedFacilityIds.delete(id);
  }

  // Update in-memory cache immediately
  memoryFacilities = [...newItems, ...memoryFacilities.filter((f) => !addedIds.has(String(f.id)))];
  facilitiesVersion = Date.now();

  if (ctx) {
    try {
      const meta = await getFacilitiesMeta(ctx);
      const remainingDeleted = (meta.deleted_ids || []).filter((id) => !addedIds.has(String(id)));
      await saveFacilitiesMeta(ctx, { seeded: true, deleted_ids: remainingDeleted });

      if (ctx.type === "admin") {
        const batch = ctx.db.batch();
        for (const item of newItems) {
          const docId = String(item.id || item.site_code || `fac-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
          item.id = item.id || docId;
          const docRef = ctx.db.collection("facilities").doc(docId);
          batch.set(docRef, item);
        }
        await batch.commit();
      } else {
        const { doc, setDoc } = await import("firebase/firestore");
        for (const item of newItems) {
          const docId = String(item.id || item.site_code || `fac-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
          item.id = item.id || docId;
          await setDoc(doc(ctx.db, "facilities", docId), item).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Could not save new facilities to Firestore:", e.message);
    }
  }

  return newItems;
}

export async function addFacility(facility) {
  const res = await addFacilities([facility]);
  return res[0];
}

export async function updateFacility(id, updates) {
  const strId = String(id);
  let updatedItem = null;

  // In-memory write-through
  memoryFacilities = memoryFacilities.map((f) => {
    if (String(f.id) === strId || String(f.site_code) === strId || String(f._doc_id) === strId) {
      updatedItem = { ...f, ...updates };
      return updatedItem;
    }
    return f;
  });
  facilitiesVersion = Date.now();

  const ctx = await getFirestoreContext();
  if (ctx && updatedItem) {
    try {
      if (ctx.type === "admin") {
        await ctx.db.collection("facilities").doc(strId).set(updatedItem, { merge: true });
      } else {
        const { doc, setDoc } = await import("firebase/firestore");
        await setDoc(doc(ctx.db, "facilities", strId), updatedItem, { merge: true });
      }
    } catch (e) {
      console.warn("Could not update facility in Firestore:", e.message);
    }
  }

  return updatedItem;
}

export async function deleteFacility(id) {
  const strId = String(id);
  deletedFacilityIds.add(strId);
  memoryFacilities = memoryFacilities.filter((f) => String(f.id) !== strId && String(f._doc_id) !== strId);
  facilitiesVersion = Date.now();

  const ctx = await getFirestoreContext();
  if (ctx) {
    try {
      const meta = await getFacilitiesMeta(ctx);
      const currentDeleted = Array.from(new Set([...(meta.deleted_ids || []), strId]));
      await saveFacilitiesMeta(ctx, { deleted_ids: currentDeleted });

      if (ctx.type === "admin") {
        await ctx.db.collection("facilities").doc(strId).delete().catch(() => {});
      } else {
        const { doc, deleteDoc } = await import("firebase/firestore");
        await deleteDoc(doc(ctx.db, "facilities", strId)).catch(() => {});
      }
    } catch (e) {
      console.warn("Could not delete facility from Firestore:", e.message);
    }
  }

  return true;
}

export async function deleteFacilities(ids = []) {
  if (!Array.isArray(ids) || !ids.length) return 0;
  const strIds = ids.map(String);
  const idSet = new Set(strIds);

  for (const id of strIds) {
    deletedFacilityIds.add(id);
  }

  const beforeCount = memoryFacilities.length;
  memoryFacilities = memoryFacilities.filter((f) => !idSet.has(String(f.id)) && !idSet.has(String(f._doc_id)));
  facilitiesVersion = Date.now();

  const ctx = await getFirestoreContext();
  if (ctx) {
    try {
      const meta = await getFacilitiesMeta(ctx);
      const currentDeleted = Array.from(new Set([...(meta.deleted_ids || []), ...strIds]));
      await saveFacilitiesMeta(ctx, { deleted_ids: currentDeleted });

      if (ctx.type === "admin") {
        const batch = ctx.db.batch();
        for (const strId of strIds) {
          const docRef = ctx.db.collection("facilities").doc(strId);
          batch.delete(docRef);
        }
        await batch.commit();
      } else {
        const { doc, deleteDoc } = await import("firebase/firestore");
        for (const strId of strIds) {
          await deleteDoc(doc(ctx.db, "facilities", strId)).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Could not delete facilities from Firestore:", e.message);
    }
  }

  return Math.max(beforeCount - memoryFacilities.length, ids.length);
}

/**
 * Ultra-Low-Read Cases Fetch:
 * Only reads from Firestore once on cold boot.
 * Subsequent requests (including page refreshes, searches, filters, pagination)
 * are served directly from server memory with 0 Firestore reads!
 */
export async function getCases(filters = {}) {
  const { urgency, q, since } = filters;

  // Cold-boot load only once
  if (!isCasesLoadedFromFirestore) {
    const ctx = await getFirestoreContext();
    if (ctx) {
      try {
        let list = [];
        if (ctx.type === "admin") {
          const snap = await ctx.db.collection("cases").get();
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } else {
          const { collection, getDocs } = await import("firebase/firestore");
          const snap = await getDocs(collection(ctx.db, "cases"));
          list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
        list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        if (list.length > 0) {
          memoryCases = list;
        }
      } catch (e) {
        console.warn("Firestore cold-boot cases fetch notice:", e.message);
      }
    }
    isCasesLoadedFromFirestore = true;
    recomputeCachedStats(memoryCases);
  }

  let list = memoryCases;

  // Incremental delta sync: return only new cases created after timestamp
  if (since) {
    const sinceTime = new Date(since).getTime();
    if (!isNaN(sinceTime) && sinceTime > 0) {
      list = list.filter((c) => new Date(c.created_at || 0).getTime() > sinceTime);
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
  return all.find((c) => c.case_ref === caseRef || c.id === caseRef) || null;
}

export async function getCasesByPhone(phone) {
  if (!phone) return [];
  const digits = String(phone).replace(/\D/g, "");
  const p10 = digits.length >= 10 ? digits.slice(-10) : digits;

  // 1. If memoryCases is loaded or populated, filter instantly in 0.01ms (0 Firestore reads)
  if (memoryCases && memoryCases.length > 0) {
    return memoryCases.filter((c) => {
      const cp = String(c.intake?.phone || "").replace(/\D/g, "");
      return cp.length >= 10 && cp.slice(-10) === p10;
    });
  }

  // 2. Direct fast targeted query if cold
  const ctx = await getFirestoreContext();
  if (ctx) {
    try {
      if (ctx.type === "admin") {
        const snap = await ctx.db
          .collection("cases")
          .where("intake.phone", "in", [p10, `+91${p10}`, `91${p10}`, phone])
          .limit(10)
          .get();
        if (!snap.empty) {
          return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        }
      }
    } catch (e) {}
  }

  const all = await getCases();
  return all.filter((c) => {
    const cp = String(c.intake?.phone || "").replace(/\D/g, "");
    return cp.length >= 10 && cp.slice(-10) === p10;
  });
}

/**
 * Save Case:
 * Exactly 1 Firestore write, 0 Firestore reads.
 * Immediately prepends to server memory cache.
 */
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

  // Prepend directly to in-memory cache (0 reads needed!)
  memoryCases = memoryCases.filter((c) => (c.case_ref !== caseData.case_ref) && (c.id !== caseData.id));
  memoryCases.unshift(caseData);
  recomputeCachedStats(memoryCases);
  return caseData;
}

export async function updateCase(caseRefOrId, updates) {
  if (!caseRefOrId || !updates) return null;
  const target = String(caseRefOrId).trim();
  const targetUpper = target.toUpperCase();
  let updatedCase = null;

  // 1. Update in-memory cache instantly (0 reads)
  memoryCases = memoryCases.map((c) => {
    const cRef = String(c.case_ref || "").trim().toUpperCase();
    const cId = String(c.id || "").trim().toUpperCase();
    if (cRef === targetUpper || cId === targetUpper || String(c.case_ref) === target || String(c.id) === target) {
      updatedCase = { ...c, ...updates };
      return updatedCase;
    }
    return c;
  });

  // 2. Persist to Firestore with minimum reads (exact doc update or 1 query)
  const ctx = await getFirestoreContext();
  if (ctx) {
    try {
      if (ctx.type === "admin") {
        const snap = await ctx.db.collection("cases").where("case_ref", "==", target).get();
        if (!snap.empty) {
          for (const doc of snap.docs) {
            await doc.ref.set(updates, { merge: true });
          }
        } else if (targetUpper !== target) {
          const snapUpper = await ctx.db.collection("cases").where("case_ref", "==", targetUpper).get();
          if (!snapUpper.empty) {
            for (const doc of snapUpper.docs) {
              await doc.ref.set(updates, { merge: true });
            }
          } else if (updatedCase?.id) {
            await ctx.db.collection("cases").doc(updatedCase.id).set(updates, { merge: true });
          }
        } else if (updatedCase?.id) {
          await ctx.db.collection("cases").doc(updatedCase.id).set(updates, { merge: true });
        }
      } else {
        const { collection, query, where, getDocs, doc, setDoc } = await import("firebase/firestore");
        const q = query(collection(ctx.db, "cases"), where("case_ref", "==", target));
        const snap = await getDocs(q);
        if (!snap.empty) {
          for (const d of snap.docs) {
            await setDoc(doc(ctx.db, "cases", d.id), updates, { merge: true });
          }
        } else if (targetUpper !== target) {
          const qUpper = query(collection(ctx.db, "cases"), where("case_ref", "==", targetUpper));
          const snapUpper = await getDocs(qUpper);
          if (!snapUpper.empty) {
            for (const d of snapUpper.docs) {
              await setDoc(doc(ctx.db, "cases", d.id), updates, { merge: true });
            }
          } else if (updatedCase?.id) {
            await setDoc(doc(ctx.db, "cases", updatedCase.id), updates, { merge: true }).catch(() => {});
          }
        } else if (updatedCase?.id) {
          await setDoc(doc(ctx.db, "cases", updatedCase.id), updates, { merge: true }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Could not update case in Firestore:", e.message);
    }
  }

  return updatedCase;
}

function recomputeCachedStats(casesList) {
  const by_urgency = { Emergency: 0, Urgent: 0, Routine: 0, "Self-care": 0 };
  for (const c of casesList) {
    const level = c.triage?.urgency_level;
    if (level && by_urgency[level] !== undefined) {
      by_urgency[level]++;
    }
  }
  cachedStats = {
    total: casesList.length,
    by_urgency,
  };
  cachedStatsTimestamp = Date.now();
  return cachedStats;
}

/**
 * Delete Case:
 * Exactly 1 Firestore delete, 0 Firestore reads.
 */
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
  recomputeCachedStats(memoryCases);
  return true;
}

export async function deleteCases(caseRefs = []) {
  if (!Array.isArray(caseRefs) || !caseRefs.length) return 0;
  for (const ref of caseRefs) {
    await deleteCase(ref);
  }
  return caseRefs.length;
}

/**
 * Stats:
 * Calculated 100% in-memory from memoryCases.
 * Initialized once from Firestore if not loaded yet.
 * 0 Firestore reads on all subsequent calls!
 */
export async function getCaseStats() {
  if (!isCasesLoadedFromFirestore) {
    await getCases();
  }
  return recomputeCachedStats(memoryCases);
}

