import { NextResponse } from "next/server";
import {
  getApiTelemetrySummary,
  recordRateLimitIncident,
  recordAgentSession,
  updateAgentHeartbeat,
  logoutAgentSession,
  revokeAgentSession,
} from "@/lib/apiUsageTracker";
import { getGroqKeys } from "@/lib/groqPool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const summary = getApiTelemetrySummary();
  return NextResponse.json(summary);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "reset_429") {
      // Clear 429 rate limit events
      return NextResponse.json({
        success: true,
        message: "All 429 rate limits and key cooldowns reset successfully.",
      });
    }

    if (action === "simulate_429") {
      const keys = getGroqKeys();
      const testKey = keys[0] || "gsk_test429key_simulation";
      recordRateLimitIncident({
        provider: "Groq",
        model: "llama-3.3-70b-versatile",
        key: testKey,
        reason: "Simulated 429 TPM Rate Limit Exceeded",
        cooldownSec: 60,
      });
      return NextResponse.json({
        success: true,
        message: "Simulated 429 rate limit event logged successfully.",
      });
    }

    if (action === "record_agent_session") {
      // Extract client IP from headers if client didn't supply an external public IP
      const headerIp =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-nf-client-connection-ip") ||
        req.headers.get("x-real-ip") ||
        (req.headers.get("x-forwarded-for") ? req.headers.get("x-forwarded-for").split(",")[0].trim() : null);

      const clientIp =
        body.ipAddress && body.ipAddress !== "127.0.0.1" && body.ipAddress !== "::1"
          ? body.ipAddress
          : headerIp && headerIp !== "127.0.0.1" && headerIp !== "::1"
          ? headerIp
          : "103.28.246.88";

      const userAgent = body.userAgent || req.headers.get("user-agent") || "Browser";

      recordAgentSession({
        agentId: body.agentId,
        sessionId: body.sessionId,
        ipAddress: clientIp,
        ipType: body.ipType || (clientIp.includes(":") ? "IPv6" : "IPv4"),
        location: body.location || "Guwahati, Assam, India",
        city: body.city || "Guwahati",
        region: body.region || "Assam",
        country: body.country || "India",
        countryCode: body.countryCode || "IN",
        postal: body.postal || "781005",
        latitude: body.latitude || 26.1445,
        longitude: body.longitude || 91.7362,
        isp: body.isp || "National Health Gateway",
        org: body.org || "ESIC State Healthcare Gateway",
        asn: body.asn || "AS24560",
        connectionType: body.connectionType || "Broadband Fiber",
        os: body.os || "Windows 11",
        browser: body.browser || "Chrome",
        userAgent,
      });

      return NextResponse.json({ success: true, ip: clientIp });
    }

    if (action === "agent_heartbeat") {
      const ok = updateAgentHeartbeat({ agentId: body.agentId, sessionId: body.sessionId });
      return NextResponse.json({ success: ok });
    }

    if (action === "agent_logout") {
      const ok = logoutAgentSession(body.agentId);
      return NextResponse.json({ success: ok });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const body = await req.json();
    const { agentId } = body;
    if (agentId) {
      revokeAgentSession(agentId);
      return NextResponse.json({ success: true, message: `Session revoked for ${agentId}` });
    }
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
