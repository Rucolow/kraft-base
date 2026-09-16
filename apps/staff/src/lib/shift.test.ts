import { describe, expect, it } from 'vitest';
import type { FollowupRow, TimelineEntryRow } from './powersync/schema';
import { canStartShift, cockpitSlot, dailyNeedsReset, deriveDigest, sessionIsStale } from './shift';

const entry = (id: string, created_at: string): TimelineEntryRow => ({
  id,
  author_id: null,
  kind: 'action',
  body: id,
  ref_type: null,
  ref_id: null,
  created_at,
});

const followup = (id: string, status: string): FollowupRow => ({
  id,
  body: id,
  guest_id: null,
  status,
  requires_owner: 0,
  created_by: null,
  created_at: '2026-06-09T00:00:00.000Z',
  resolved_at: null,
});

describe('shift start gating', () => {
  it('blocks start until the handover is acknowledged', () => {
    expect(canStartShift(null)).toBe(false);
    expect(canStartShift('')).toBe(false);
    expect(canStartShift('2026-06-09T08:00:00.000Z')).toBe(true);
  });
});

describe('handover digest range', () => {
  const timeline = [
    entry('a', '2026-06-09T06:00:00.000Z'),
    entry('b', '2026-06-09T09:00:00.000Z'),
    entry('c', '2026-06-09T11:00:00.000Z'),
  ];
  const followups = [followup('f1', 'open'), followup('f2', 'done')];

  it('includes entries from the previous shift onward', () => {
    const digest = deriveDigest({ started_at: '2026-06-09T08:00:00.000Z' }, timeline, followups);
    expect(digest.entries.map((e) => e.id)).toEqual(['b', 'c']);
  });

  // The handover exists to carry the previous staff's notes forward. Anchoring on
  // ended_at dropped every one of them (they all predate the clock-out).
  it('keeps notes the previous staff wrote during their own shift', () => {
    const digest = deriveDigest({ started_at: '2026-06-09T05:00:00.000Z' }, timeline, followups);
    expect(digest.entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  // Forgotten 退勤 → closeStaleSessions stamps ended_at at today's 04:00, which is
  // later than everything written the evening before. started_at is unaffected.
  it('survives an auto-closed session (forgotten clock-out)', () => {
    const autoClosed = {
      started_at: '2026-06-09T05:00:00.000Z',
      ended_at: '2026-06-09T19:00:00.000Z', // 04:00 JST boundary, after every entry
    };
    const digest = deriveDigest(autoClosed, timeline, followups);
    expect(digest.entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('includes the whole timeline when there is no previous session', () => {
    const digest = deriveDigest(null, timeline, followups);
    expect(digest.entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps only open followups', () => {
    const digest = deriveDigest(null, timeline, followups);
    expect(digest.followups.map((f) => f.id)).toEqual(['f1']);
  });
});

describe('stale session boundary', () => {
  const boundary = '2026-06-09T19:00:00.000Z'; // 04:00 JST

  it('treats sessions started before the boundary as stale', () => {
    expect(sessionIsStale('2026-06-09T10:00:00.000Z', boundary)).toBe(true);
  });

  it('keeps sessions started after the boundary', () => {
    expect(sessionIsStale('2026-06-09T20:00:00.000Z', boundary)).toBe(false);
  });
});

describe('daily reset', () => {
  it('resets when the recorded date is older than today', () => {
    expect(dailyNeedsReset('2026-06-08', '2026-06-09')).toBe(true);
    expect(dailyNeedsReset(null, '2026-06-09')).toBe(true);
  });

  it('does not reset on the same day', () => {
    expect(dailyNeedsReset('2026-06-09', '2026-06-09')).toBe(false);
  });
});

describe('cockpit duty slot by hour', () => {
  // The boundaries are the contract: 04:00 (= the shift-day reset) and 16:00.
  it('runs 先当番 from 04:00 to 15:59', () => {
    expect(cockpitSlot(4)).toBe('first');
    expect(cockpitSlot(15)).toBe('first');
  });

  it('runs 後当番 from 16:00 through 03:59', () => {
    expect(cockpitSlot(16)).toBe('second');
    expect(cockpitSlot(3)).toBe('second');
    expect(cockpitSlot(0)).toBe('second');
  });
});
