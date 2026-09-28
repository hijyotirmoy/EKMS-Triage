import { NextResponse } from "next/server";
import { getFirestoreDb } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  limit,
} from "firebase/firestore";

// Local in-memory calls store and query cache to eliminate repetitive Firestore reads
const memoryCalls = new Map();
let ringingQueryCache = null;
let ringingQueryCacheTs = 0;
const RINGING_CACHE_TTL_MS = 10000; // 10 seconds cache for ringing call queries

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get("callId");
  const role = searchParams.get("role"); // 'agent' | 'caller'
  const agentId = searchParams.get("agentId");
  const now = Date.now();

  try {
    // 1. Agent checking for incoming ringing calls
    if (role === "agent" && !callId) {
      // Step A: Check in-memory active calls first (0 Firestore reads)
      for (const [id, call] of memoryCalls.entries()) {
        if (call.status === "ringing" && now - (call.updatedAt || call.createdAt || 0) < 60000) {
          if (agentId) {
            const target = (call.targetAgent || "Agent 1").toLowerCase().replace(/\s+/g, "");
            const myAgent = agentId.toLowerCase().replace(/\s+/g, "");
            if (target !== myAgent) continue;
          }
          return NextResponse.json({ activeCall: call });
        }
      }

      // Step B: Check in-memory ringing query cache before querying Firestore
      if (ringingQueryCache !== null && now - ringingQueryCacheTs < RINGING_CACHE_TTL_MS) {
        if (ringingQueryCache) {
          if (agentId) {
            const target = (ringingQueryCache.targetAgent || "Agent 1").toLowerCase().replace(/\s+/g, "");
            const myAgent = agentId.toLowerCase().replace(/\s+/g, "");
            if (target === myAgent) {
              return NextResponse.json({ activeCall: ringingQueryCache });
            }
          } else {
            return NextResponse.json({ activeCall: ringingQueryCache });
          }
        }
        return NextResponse.json({ activeCall: null });
      }

      // Step C: Query Firestore at most once every 10s
      try {
        const db = getFirestoreDb();
        const q = query(
          collection(db, "calls"),
          where("status", "==", "ringing"),
          limit(5)
        );
        const snap = await getDocs(q);
        let foundCall = null;
        for (const docSnap of snap.docs) {
          const call = docSnap.data();
          if (call && now - (call.updatedAt || call.createdAt || 0) < 60000) {
            memoryCalls.set(call.id, call);
            foundCall = call;
            break;
          }
        }
        ringingQueryCache = foundCall;
        ringingQueryCacheTs = now;

        if (foundCall) {
          if (agentId) {
            const target = (foundCall.targetAgent || "Agent 1").toLowerCase().replace(/\s+/g, "");
            const myAgent = agentId.toLowerCase().replace(/\s+/g, "");
            if (target === myAgent) {
              return NextResponse.json({ activeCall: foundCall });
            }
          } else {
            return NextResponse.json({ activeCall: foundCall });
          }
        }
      } catch (e) {
        console.warn("Firestore GET ringing calls error:", e.message);
      }

      return NextResponse.json({ activeCall: null });
    }

    // 2. Polling specific call state
    if (callId) {
      // Check memoryCalls first (0 Firestore reads)
      const call = memoryCalls.get(callId);
      if (call && now - (call.updatedAt || 0) < 15000) {
        return NextResponse.json(call);
      }

      try {
        const db = getFirestoreDb();
        const docRef = doc(db, "calls", callId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          memoryCalls.set(callId, data);
          return NextResponse.json(data);
        }
      } catch (e) {
        console.warn("Firestore GET callId error:", e.message);
      }

      if (call) {
        return NextResponse.json(call);
      }
      return NextResponse.json({ status: "pending" });
    }

    return NextResponse.json({ status: "idle" });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, callId, data = {} } = body;
    const now = Date.now();
    const db = getFirestoreDb();

    if (action === "initiate") {
      const newCallId =
        callId || "call-" + Math.random().toString(36).substring(2, 9);
      const callData = {
        id: newCallId,
        callerInfo: data.callerInfo || {
          name: "Insured Person (IP)",
          phone: "",
          city: "",
        },
        targetAgent: data.targetAgent || "Agent 1",
        offer: data.offer || null,
        answer: null,
        callerCandidates: data.candidates || [],
        calleeCandidates: [],
        status: "ringing",
        createdAt: now,
        updatedAt: now,
      };

      try {
        await setDoc(doc(db, "calls", newCallId), callData);
      } catch (e) {
        console.warn("Firestore initiate save error:", e.message);
      }
      memoryCalls.set(newCallId, callData);
      ringingQueryCache = callData;
      ringingQueryCacheTs = now;

      return NextResponse.json({
        success: true,
        callId: newCallId,
        call: callData,
      });
    }

    if (!callId) {
      return NextResponse.json(
        { success: false, error: "Call ID required" },
        { status: 400 }
      );
    }

    const docRef = doc(db, "calls", callId);

    if (action === "accept" || action === "answer") {
      ringingQueryCache = null;
      ringingQueryCacheTs = 0;
      const updatePayload = {
        status: "connected",
        updatedAt: now,
      };
      if (data?.answer) {
        updatePayload.answer = data.answer;
      }

      try {
        await updateDoc(docRef, updatePayload);
      } catch (e) {
        console.warn("Firestore accept update error:", e.message);
      }

      const current = memoryCalls.get(callId) || {};
      Object.assign(current, updatePayload);
      memoryCalls.set(callId, current);

      return NextResponse.json({ success: true, call: current });
    }

    if (action === "candidate") {
      if (data.candidate) {
        try {
          const field =
            data.role === "caller" ? "callerCandidates" : "calleeCandidates";
          await setDoc(docRef, {
            [field]: arrayUnion(data.candidate),
            updatedAt: now,
          }, { merge: true });
        } catch (e) {
          console.warn("Firestore candidate update error:", e.message);
        }

        const current = memoryCalls.get(callId);
        if (current) {
          if (data.role === "caller") {
            current.callerCandidates = current.callerCandidates || [];
            current.callerCandidates.push(data.candidate);
          } else {
            current.calleeCandidates = current.calleeCandidates || [];
            current.calleeCandidates.push(data.candidate);
          }
        }
      }
      return NextResponse.json({ success: true });
    }

    if (action === "transcript") {
      if (data?.transcript) {
        try {
          if (data.transcript.isFinal) {
            await setDoc(
              docRef,
              { transcripts: arrayUnion(data.transcript), updatedAt: now },
              { merge: true }
            );
          } else {
            await setDoc(
              docRef,
              { interimTranscript: data.transcript, updatedAt: now },
              { merge: true }
            );
          }
        } catch (e) {}
      }
      return NextResponse.json({ success: true });
    }

    if (action === "hold") {
      try {
        await updateDoc(docRef, { onHold: true, updatedAt: now });
      } catch (e) {}
      const current = memoryCalls.get(callId);
      if (current) current.onHold = true;
      return NextResponse.json({ success: true, onHold: true });
    }

    if (action === "resume") {
      try {
        await updateDoc(docRef, { onHold: false, updatedAt: now });
      } catch (e) {}
      const current = memoryCalls.get(callId);
      if (current) current.onHold = false;
      return NextResponse.json({ success: true, onHold: false });
    }

    if (action === "hangup" || action === "reject") {
      ringingQueryCache = null;
      ringingQueryCacheTs = 0;
      try {
        await updateDoc(docRef, { status: "ended", updatedAt: now });
      } catch (e) {}
      const current = memoryCalls.get(callId);
      if (current) current.status = "ended";
      setTimeout(() => memoryCalls.delete(callId), 5000);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
