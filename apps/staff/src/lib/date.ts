// JST is treated as an opaque 'YYYY-MM-DD' string (spec §5). All calendar logic
// runs in Asia/Tokyo regardless of the device timezone.

const JST = 'Asia/Tokyo';

export function jstDate(at: Date = new Date()): string {
  return at.toLocaleDateString('en-CA', { timeZone: JST });
}

export function jstHour(at: Date = new Date()): number {
  return Number.parseInt(
    at.toLocaleString('en-US', { timeZone: JST, hour: '2-digit', hour12: false }),
    10,
  );
}

export function nowIso(at: Date = new Date()): string {
  return at.toISOString();
}

// Instant of today's 04:00 JST shift boundary, as an ISO string. Sessions started
// before this are stale (spec §4.4).
export function shiftBoundaryIso(at: Date = new Date()): string {
  return new Date(`${jstDate(at)}T04:00:00+09:00`).toISOString();
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: JST,
    hour: '2-digit',
    minute: '2-digit',
  });
}
