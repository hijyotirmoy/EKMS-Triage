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

// Local in-memory fallback in case Firestore is unreachable
const memoryCalls = new Map();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get("callId");
  const role = searchParams.get("role"); // 'agent' | 'caller'
  const agentId = searchParams.get("agentId");

  try {
    const db = getFirestoreDb();

    // 1. Agent checking for incoming ringing calls
    if (role === "agent" && !callId) {
      // Check Firestore
      try {
        const q = query(
          collection(db, "calls"),
          where("status", "==", "ringing"),
          limit(5)
        );
        const snap = await getDocs(q);
        const now = Date.now();
        for (const docSnap of snap.docs) {
          const call = docSnap.data();
          // Valid if updated/created within the last 60 seconds
          if (call && now - (call.updatedAt || call.createdAt || 0) < 60000) {
            if (agentId) {
              const target = (call.targetAgent || "Agent 1").toLowerCase().replace(/\s+/g, "");
              const myAgent = agentId.toLowerCase().replace(/\s+/g, "");
              if (target !== myAgent) continue;
            }
            return NextResponse.json({ activeCall: call });
          }
        }
      } catch (e) {
        console.warn("Firestore GET ringing calls error:", e.message);
      }

      // Memory fallback
      for (const [id, call] of memoryCalls.entries()) {
        if (call.status === "ringing" && Date.now() - call.updatedAt < 60000) {
          if (agentId) {
            const target = (call.targetAgent || "Agent 1").toLowerCase().replace(/\s+/g, "");
            const myAgent = agentId.toLowerCase().replace(/\s+/g, "");
            if (target !== myAgent) continue;
          }
          return NextResponse.json({ activeCall: call });
        }
      }
      return NextResponse.json({ activeCall: null });
    }

    // 2. Polling specific call state
    if (callId) {
      try {
        const docRef = doc(db, "calls", callId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return NextResponse.json(snap.data());
        }
      } catch (e) {
        console.warn("Firestore GET callId error:", e.message);
      }

      // Memory fallback
      const call = memoryCalls.get(callId);
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
          await updateDoc(docRef, {
            [field]: arrayUnion(data.candidate),
            updatedAt: now,
          });
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
