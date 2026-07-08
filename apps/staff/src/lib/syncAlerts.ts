import { nowIso } from './date';

// When the connector uploads a write that Postgres rejects for good (RLS 42xxx,
// integrity 23xxx, data 22xxx), it discards the op so one bad write can't wedge
// all sync forever. But that discard was console-only: to the user the change
// just silently vanished, and every past incident took a code-diving session to
// diagnose. This tiny store keeps the last few discards so a badge can surface
// them — a single screenshot then tells us table + time + Postgres code.

export interface SyncAlert {
  table: string;
  op: string;
  code: string;
  message: string;
  at: string;
}

const STORAGE_KEY = 'kb.syncAlerts';
const MAX = 20;

function load(): SyncAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SyncAlert[]) : [];
  } catch {
    return [];
  }
}

let alerts: SyncAlert[] = load();
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    /* storage unavailable */
  }
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function recordSyncAlert(input: {
  table: string;
  op: string;
  code: string;
  message: string;
}): void {
  const entry: SyncAlert = { ...input, at: nowIso() };
  alerts = [entry, ...alerts].slice(0, MAX);
  persist();
  emit();
}

// Stable reference between renders (only reassigned on change) so it can back a
// useSyncExternalStore getSnapshot without tripping the infinite-loop guard.
export function getSyncAlerts(): SyncAlert[] {
  return alerts;
}

export function clearSyncAlerts(): void {
  if (alerts.length === 0) {
    return;
  }
  alerts = [];
  persist();
  emit();
}

export function subscribeSyncAlerts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
