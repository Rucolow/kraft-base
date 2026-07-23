import { useQuery } from '@powersync/react';
import { shiftDate } from '../lib/date';
import { addDays } from '../lib/month';
import type {
  BentoOrderRow,
  ContentRow,
  EquipmentIssueRow,
  FollowupRow,
  GuestNoteRow,
  GuestRow,
  LostItemRow,
  ShiftPlanRow,
  ShiftSessionRow,
  StaffRow,
  TaskRow,
  TimelineEntryRow,
} from '../lib/powersync/schema';

export function useStaff() {
  return useQuery<StaffRow>('SELECT * FROM staff ORDER BY role, name');
}

export function useShiftSessions() {
  return useQuery<ShiftSessionRow>('SELECT * FROM shift_session ORDER BY started_at DESC');
}

export function useTodaysGuests() {
  return useQuery<GuestRow>(
    "SELECT * FROM guest WHERE stay_date = ? ORDER BY COALESCE(checkin_time, '~~')",
    [shiftDate()],
  );
}

export function useUpcomingGuests() {
  return useQuery<GuestRow>(
    "SELECT * FROM guest WHERE stay_date > ? ORDER BY stay_date, COALESCE(checkin_time, '~~')",
    [shiftDate()],
  );
}

// All guests in a calendar month ('YYYY-MM'). stay_date is 'YYYY-MM-DD' text, so a
// string range covers the month; '-31' as the upper bound is safe for every month
// (no real day sorts above it).
export function useGuestsInMonth(ym: string) {
  return useQuery<GuestRow>(
    "SELECT * FROM guest WHERE stay_date >= ? AND stay_date <= ? ORDER BY stay_date, COALESCE(checkin_time, '~~')",
    [`${ym}-01`, `${ym}-31`],
  );
}

// Shift-plan (rota) rows for a calendar month. (Bulk ops read their own source
// days directly, so no margin is needed here.)
export function useShiftPlansInMonth(ym: string) {
  return useQuery<ShiftPlanRow>(
    'SELECT * FROM shift_plan WHERE date >= ? AND date <= ? ORDER BY date, created_at',
    [`${ym}-01`, `${ym}-31`],
  );
}

// koguchi-bento order mirror ------------------------------------------------

export function useBentoOrdersForDate(date: string) {
  return useQuery<BentoOrderRow>('SELECT * FROM bento_order WHERE delivery_date = ? ORDER BY id', [
    date,
  ]);
}

// All orders delivering AFTER a date, in one watch — feeds the per-date summary
// lines and per-guest chips on the "これから先" tab (R5). One range query beats
// one useBentoOrdersForDate per date group (which would spawn a watch per date).
export function useBentoOrdersAfter(date: string) {
  return useQuery<BentoOrderRow>(
    'SELECT * FROM bento_order WHERE delivery_date > ? ORDER BY delivery_date, id',
    [date],
  );
}

export function useBentoOrdersForGuest(guestId: string) {
  return useQuery<BentoOrderRow>(
    'SELECT * FROM bento_order WHERE guest_id = ? ORDER BY delivery_date',
    [guestId],
  );
}

// Guests within ±2 days of a delivery date, for the manual-match picker. The
// window covers multi-night stays whose per-day guest row wasn't created (link
// to the first-day row instead).
export function useGuestsAroundDate(date: string, days = 2) {
  const from = addDays(date, -days);
  const to = addDays(date, days);
  return useQuery<GuestRow>(
    "SELECT * FROM guest WHERE stay_date >= ? AND stay_date <= ? AND status != 'cancelled' ORDER BY stay_date, name",
    [from, to],
  );
}

export function useGuest(id: string) {
  return useQuery<GuestRow>('SELECT * FROM guest WHERE id = ?', [id]);
}

export function useGuestNotes(guestId: string) {
  return useQuery<GuestNoteRow>('SELECT * FROM guest_note WHERE guest_id = ? ORDER BY created_at', [
    guestId,
  ]);
}

export function useTimeline() {
  return useQuery<TimelineEntryRow>(
    'SELECT * FROM timeline_entry ORDER BY created_at DESC LIMIT 80',
  );
}

export function useOpenFollowups() {
  return useQuery<FollowupRow>(
    "SELECT * FROM followup WHERE status = 'open' ORDER BY requires_owner DESC, created_at DESC",
  );
}

export function useTasks() {
  return useQuery<TaskRow>(
    'SELECT * FROM task ORDER BY "group", COALESCE(phase, \'\'), created_at',
  );
}

export function useManualTasks(phases: string[]) {
  const placeholders = phases.map(() => '?').join(', ') || 'NULL';
  return useQuery<TaskRow>(
    `SELECT * FROM task WHERE source = 'manual' AND phase IN (${placeholders}) ORDER BY phase, created_at`,
    phases,
  );
}

export function useContentByKind(kind: string) {
  return useQuery<ContentRow>('SELECT * FROM content WHERE kind = ? ORDER BY status DESC, title', [
    kind,
  ]);
}

export function useContentBySlug(slug: string) {
  return useQuery<ContentRow>('SELECT * FROM content WHERE slug = ?', [slug]);
}

export function useProcedureForPhase(phase: string) {
  return useQuery<ContentRow>(
    "SELECT * FROM content WHERE kind = 'procedure' AND phase = ? ORDER BY title",
    [phase],
  );
}

export function useGrowItems() {
  return useQuery<ContentRow>(
    "SELECT * FROM content WHERE status = 'needs_input' ORDER BY kind, title",
  );
}

export function useLostItems() {
  return useQuery<LostItemRow>('SELECT * FROM lost_item ORDER BY created_at DESC');
}

export function useEquipmentIssues() {
  return useQuery<EquipmentIssueRow>('SELECT * FROM equipment_issue ORDER BY created_at DESC');
}

// "You" queue: notes mentioning me that I have not read (spec §6).
export function useMentions(staffId: string | null) {
  return useQuery<GuestNoteRow>(
    `SELECT * FROM guest_note
       WHERE mentions LIKE ? AND (read_by NOT LIKE ? OR read_by IS NULL)
       ORDER BY created_at DESC`,
    [`%"${staffId ?? ''}"%`, `%"${staffId ?? ''}"%`],
  );
}
