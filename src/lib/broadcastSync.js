// Real-Time Cross-Tab & Cross-Window Synchronization
// Provides instant 0-latency updates across all open tabs with 0 Firestore reads

const CHANNEL_NAME = "ekms_triage_sync_v1";

let channel = null;

function getChannel() {
  if (typeof window === "undefined") return null;
  if (!channel && typeof window.BroadcastChannel !== "undefined") {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      console.warn("BroadcastChannel not supported in this environment:", e);
    }
  }
  return channel;
}

/**
 * Broadcast an event to all other open tabs/windows
 */
export function broadcastEvent(type, payload = {}) {
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage({
      type,
      payload,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.warn("Broadcast event error:", e);
  }
}

/**
 * Subscribe to real-time events from other tabs/windows
 */
export function subscribeToSync(handler) {
  const ch = getChannel();
  if (!ch) return () => {};

  const listener = (event) => {
    if (event && event.data && typeof handler === "function") {
      handler(event.data);
    }
  };

  ch.addEventListener("message", listener);
  return () => {
    try {
      ch.removeEventListener("message", listener);
    } catch (_) {}
  };
}
