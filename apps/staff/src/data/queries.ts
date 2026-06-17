import { useQuery } from '@powersync/react';
import { jstDate } from '../lib/date';
import type {
  ContentRow,
  EquipmentIssueRow,
  FollowupRow,
  GuestNoteRow,
  GuestRow,
  LostItemRow,
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
    [jstDate()],
  );
}

export function useUpcomingGuests() {
  return useQuery<GuestRow>(
    "SELECT * FROM guest WHERE stay_date > ? ORDER BY stay_date, COALESCE(checkin_time, '~~')",
    [jstDate()],
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
