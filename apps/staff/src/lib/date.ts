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

// Calendar date (JST) of the current shift-day. The shift-day runs 04:00→04:00
// (spec §4.4), so the hours between midnight and 04:00 still belong to the previous
// calendar date's shift. Daily resets and session staleness key off this, not the
// raw calendar date, so the close routine and a running shift survive midnight.
export function shiftDate(at: Date = new Date()): string {
  const base = jstHour(at) % 24 < 4 ? new Date(at.getTime() - 24 * 60 * 60 * 1000) : at;
  return jstDate(base);
}

// Start of the current shift-day as an ISO string. Sessions started before this
// are stale (spec §4.4). Using today's 04:00 unconditionally would wrongly treat a
// shift started at, say, 00:30 as stale, leaving night staff unable to start a
// shift during the late-arrival window.
export function shiftBoundaryIso(at: Date = new Date()): string {
  return new Date(`${shiftDate(at)}T04:00:00+09:00`).toISOString();
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: JST,
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 'YYYY-MM-DD' -> e.g. '6/18(水)' in JST, for grouping upcoming stays by date.
export function formatStayDate(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ja-JP', {
    timeZone: JST,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}
