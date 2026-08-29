import type { GuestRow } from './powersync/schema';

// The house's bed chips (single source — GuestEdit renders these).
export const BEDS = ['1番', '2番', '3番', '4番', '5番', '6番', '和室'];

// Bed strings are free-ish text: chip-built rows store "1番・2番", legacy rows
// carry things like "1・2番（下段）". Digits are the one reliable signal for the
// numbered bunks (all single-digit); 和室 has no digit and is matched literally.
export function bedNumbers(bed: string | null | undefined): number[] {
  if (!bed) {
    return [];
  }
  // Parentheticals carry annotations, not bed identity — "和室（2名）" must not
  // read as bed 2, and "1・2番（下段）" is unaffected by stripping them.
  const stripped = bed.replace(/[（(][^）)]*[）)]/g, '');
  return [...new Set((stripped.match(/\d+/g) ?? []).map(Number).filter((n) => n >= 1 && n <= 9))];
}

function chipMatches(chip: string, numbers: Set<number>, texts: string[]): boolean {
  const digits = bedNumbers(chip);
  if (digits.length > 0) {
    return digits.some((n) => numbers.has(n));
  }
  return texts.some((text) => text.includes(chip));
}

// Which bed chips were slept in by the given day's guests (R8: 前日に使った
// ベッド). Cancelled bookings never occupied a bed. Returns chips in house order.
export function usedBedChips(
  guests: Pick<GuestRow, 'bed' | 'status'>[],
  chips: string[] = BEDS,
): string[] {
  const active = guests.filter((guest) => guest.status !== 'cancelled');
  const numbers = new Set(active.flatMap((guest) => bedNumbers(guest.bed)));
  const texts = active.map((guest) => guest.bed ?? '');
  return chips.filter((chip) => chipMatches(chip, numbers, texts));
}
