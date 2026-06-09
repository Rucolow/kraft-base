import type { FollowupRow, ShiftSessionRow, TimelineEntryRow } from './powersync/schema';

export type Phase = 'midday_prep' | 'cleaning' | 'evening_close' | 'morning_prep';

export interface HandoverDigest {
  entries: TimelineEntryRow[];
  followups: FollowupRow[];
  since: string | null;
}

// Cockpit context derived from the JST hour (spec §7.2).
export function currentPhase(hour: number): Phase {
  if (hour < 11) {
    return 'morning_prep';
  }
  if (hour < 16) {
    return 'midday_prep';
  }
  if (hour < 19) {
    return 'cleaning';
  }
  return 'evening_close';
}

// Phases surfaced on the cockpit now. Before close, the next morning's set is
// also surfaced (spec §7.2: 20時前にも翌朝セット).
export function cockpitPhases(hour: number): Phase[] {
  const phase = currentPhase(hour);
  return phase === 'evening_close' ? ['evening_close', 'morning_prep'] : [phase];
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

// Digest = timeline since the previous session ended + still-open followups (spec §6).
export function deriveDigest(
  previousSession: Pick<ShiftSessionRow, 'ended_at'> | null,
  timeline: TimelineEntryRow[],
  followups: FollowupRow[],
): HandoverDigest {
  const since = previousSession?.ended_at ?? null;
  const entries = since ? timeline.filter((entry) => (entry.created_at ?? '') >= since) : timeline;
  const openFollowups = followups.filter((followup) => followup.status === 'open');
  return { entries, followups: openFollowups, since };
}
