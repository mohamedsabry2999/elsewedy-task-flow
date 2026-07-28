// Cross-tab deduped notification audio + desktop notifications.
// - BroadcastChannel prevents multiple tabs from playing the same sound.
// - Server-side `played_at` guard (via markNotificationPlayed) ensures each
//   notification plays exactly once even after refresh or across tabs.
import { playNormal, playSiren, unlockAudio } from "@/lib/notification-sound";

const CHANNEL = "elsewedy-notif-audio";
let bc: BroadcastChannel | null = null;
const played = new Set<string>();

function getChannel() {
  if (typeof window === "undefined") return null;
  if (!bc && typeof BroadcastChannel !== "undefined") {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (e) => {
      if (e.data?.type === "played" && e.data.id) played.add(e.data.id);
    };
  }
  return bc;
}

export function initAudioChannel() { getChannel(); }

export async function playForNotificationOnce(
  n: { id: string; severity?: string | null; title?: string; body?: string },
  opts: { volumeNormal: number; volumeUrgent: number; desktop?: boolean }
) {
  if (played.has(n.id)) return false;
  played.add(n.id);
  getChannel()?.postMessage({ type: "played", id: n.id });

  // Server guard: only the first client to claim it plays.
  try {
    const { markNotificationPlayed } = await import("@/lib/tasks.functions");
    const res = await markNotificationPlayed({ data: { id: n.id } });
    if (!res?.claimed) return false;
  } catch { /* fall through — best-effort */ }

  const urgent = n.severity === "urgent";
  if (urgent) playSiren(opts.volumeUrgent);
  else playNormal(opts.volumeNormal);

  if (opts.desktop && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(n.title || "إشعار", { body: n.body || "", tag: n.id, silent: true });
    } catch { /* ignore */ }
  }
  return true;
}

export function isAudioUnlocked(): boolean {
  return typeof window !== "undefined" && !!(window as any).__elsewedyAudioUnlocked;
}

export function markAudioUnlocked() {
  if (typeof window === "undefined") return;
  (window as any).__elsewedyAudioUnlocked = true;
  unlockAudio();
}

export async function requestDesktopPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  return await Notification.requestPermission();
}

export function currentDesktopPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}
