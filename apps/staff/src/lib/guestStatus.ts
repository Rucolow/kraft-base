export type GuestStatus = 'expected' | 'arrived' | 'late' | 'cancelled';

// Order shown in the status picker.
export const GUEST_STATUSES: GuestStatus[] = ['expected', 'arrived', 'late', 'cancelled'];

const META: Record<GuestStatus, { label: string; tone: 'ok' | 'warn' | 'neutral' }> = {
  expected: { label: '予定', tone: 'warn' },
  arrived: { label: '到着済', tone: 'ok' },
  late: { label: '遅着', tone: 'warn' },
  cancelled: { label: 'キャンセル', tone: 'neutral' },
};

export function guestStatusMeta(status: string | null) {
  return META[status as GuestStatus] ?? META.expected;
}

export function guestStatusLabel(status: string | null): string {
  return guestStatusMeta(status).label;
}
