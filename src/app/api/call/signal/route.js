import { NextResponse } from "next/server";

// In-memory active calls signaling store
const activeCalls = new Map();

// Auto cleanup expired calls older than 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, call] of activeCalls.entries()) {
    if (now - call.updatedAt > 15 * 60 * 1000) {
      activeCalls.delete(id);
    }
  }
}, 60000);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get("callId");
  const role = searchParams.get("role"); // 'agent' | 'caller'

  // Agent checking for incoming ringing calls
  if (role === "agent" && !callId) {
    for (const [id, call] of activeCalls.entries()) {
      if (call.status === "ringing" && Date.now() - call.updatedAt < 60000) {
        return NextResponse.json({ activeCall: call });
      }
    }
    return NextResponse.json({ activeCall: null });
  }

  // Polling specific call state
  if (callId) {
    const call = activeCalls.get(callId);
    if (!call) {
      return NextResponse.json({ status: "ended" });
    }
    return NextResponse.json(call);
  }

  return NextResponse.json({ status: "idle" });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, callId, data } = body;
    const now = Date.now();

    if (action === "initiate") {
      const newCallId = callId || "call-" + Math.random().toString(36).substring(2, 9);
      const callData = {
        id: newCallId,
        callerInfo: data.callerInfo || { name: "Insured Person (IP)", phone: "", city: "" },
        offer: data.offer || null,
        answer: null,
        callerCandidates: data.candidates || [],
        calleeCandidates: [],
        status: "ringing",
        createdAt: now,
        updatedAt: now,
      };
      activeCalls.set(newCallId, callData);
      return NextResponse.json({ success: true, callId: newCallId, call: callData });
    }

    if (!callId || !activeCalls.has(callId)) {
      return NextResponse.json({ success: false, error: "Call not found or ended" }, { status: 404 });
    }

    const current = activeCalls.get(callId);
    current.updatedAt = now;

    if (action === "answer") {
      current.answer = data.answer;
      current.status = "connected";
      return NextResponse.json({ success: true, call: current });
    }

    if (action === "candidate") {
      if (data.role === "caller") {
        current.callerCandidates.push(data.candidate);
      } else {
        current.calleeCandidates.push(data.candidate);
      }
      return NextResponse.json({ success: true });
    }

    if (action === "hangup" || action === "reject") {
      current.status = "ended";
      setTimeout(() => activeCalls.delete(callId), 5000);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
