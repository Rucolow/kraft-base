import type { FollowupRow, ShiftSessionRow, TimelineEntryRow } from './powersync/schema';

export type Slot = 'first' | 'second';

export interface HandoverDigest {
  entries: TimelineEntryRow[];
  followups: FollowupRow[];
  since: string | null;
}

// R12: which duty (当番) the cockpit shows, from the JST hour.
// 先当番 = 04:00–15:59, 後当番 = 16:00–03:59. The lower edge is 04:00, not 05:00,
// so it lines up with the shift-day boundary (date.ts shiftDate): the daily reset
// runs at 04:00, and anything else would leave 04:00–04:59 showing a freshly
// zeroed 後当番 list that nobody is on duty for. 03:00 correctly still shows the
// previous shift-day's 後当番.
export function cockpitSlot(hour: number): Slot {
  return hour >= 4 && hour < 16 ? 'first' : 'second';
}

export function shiftContextLabel(hour: number): string {
  if (hour < 5) {
    return '夜間';
  }
  if (hour < 11) {
    return '早朝';
  }
  if (hour < 16) {
    return '日中シフト';
  }
  if (hour < 19) {
    return '夜シフト';
  }
  return '夜シフト・クローズ前';
}

// Daily tasks reset when the recorded reset date is older than today (spec §5).
export function dailyNeedsReset(lastResetDate: string | null, today: string): boolean {
  return lastResetDate === null || lastResetDate < today;
}

// A session is stale once it predates today's 04:00 JST boundary (spec §4.4).
export function sessionIsStale(startedAtIso: string, boundaryIso: string): boolean {
  return startedAtIso < boundaryIso;
}

// Start is gated on an acknowledged handover (spec §4.4 / §7.1).
export function canStartShift(handoverReviewedAtIso: string | null): boolean {
  return handoverReviewedAtIso !== null && handoverReviewedAtIso !== '';
}

// Digest = the previous shift's timeline + everything since + still-open
// followups (spec §6).
//
// The window opens at the previous session's START, not its end. Anchoring on
// ended_at dropped exactly what a handover is for: notes the previous staff
// wrote *during* their shift all predate their clock-out, so 「前シフトの記録」
// was near-permanently empty. The 04:00 auto-close made it worse — a forgotten
// 退勤 stamps ended_at at today's boundary, filtering out the whole previous
// evening on the morning someone most needs to read it.
export function deriveDigest(
  previousSession: Pick<ShiftSessionRow, 'started_at'> | null,
  timeline: TimelineEntryRow[],
  followups: FollowupRow[],
): HandoverDigest {
  const since = previousSession?.started_at || null;
  const entries = since ? timeline.filter((entry) => (entry.created_at ?? '') >= since) : timeline;
  const openFollowups = followups.filter((followup) => followup.status === 'open');
  return { entries, followups: openFollowups, since };
}
