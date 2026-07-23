import { guestStatusMeta } from '../lib/guestStatus';
import type { GuestRow } from '../lib/powersync/schema';
import { Badge, Card } from './ui';

// Cancelled guests stay visible (greyed) but must not inflate headcounts used for
// prep — kept consistent with the home cockpit, which counts active guests only.
export const isActive = (guest: GuestRow) => guest.status !== 'cancelled';

// Total guests (people), not bookings: a single representative booking a party of
// N counts as N. Cancelled bookings excluded. The one source of truth so lists,
// tabs, the home badge and the calendar all agree.
export const headcount = (guests: GuestRow[]): number =>
  guests.filter(isActive).reduce((sum, guest) => sum + (guest.party_size ?? 1), 0);

export function GuestCard({
  guest,
  onOpen,
  bentoChip,
}: {
  guest: GuestRow;
  onOpen: () => void;
  // A "焼肉×2・ベジタリアン×1" summary of this guest's linked bento orders, shown
  // as a chip so a list of guests reads who has ordered at a glance (R5). Omitted
  // (undefined) where the caller doesn't wire bento data.
  bentoChip?: string | null;
}) {
  const status = guestStatusMeta(guest.status);
  const cancelled = guest.status === 'cancelled';
  // Build the meta line from present fields only, so a missing country, time or
  // bed doesn't leave a dangling separator (e.g. "IN 19:00・" with no bed).
  const meta = [guest.country, `${guest.party_size ?? 1}名`].filter(Boolean).join('・');
  // "未定" checkin time is surfaced as a badge (an all-day wait is an exception
  // worth spotting), so keep it out of the muted meta line to avoid duplication.
  const undecidedCheckin = guest.checkin_time === '未定';
  const inParts = [undecidedCheckin ? null : guest.checkin_time, guest.bed]
    .filter(Boolean)
    .join('・');
  return (
    <Card onClick={onOpen}>
      <div className={`flex items-center gap-2.5 ${cancelled ? 'opacity-55' : ''}`}>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-bold text-[0.96rem] ${cancelled ? 'line-through' : ''}`}>
              {guest.name}
            </span>
            {guest.whole_house === 1 ? <Badge tone="wood">貸切</Badge> : null}
            {undecidedCheckin ? <Badge tone="warn">IN未定</Badge> : null}
          </div>
          <div className="mt-0.5 text-[0.76rem] text-ink-light">
            {meta}
            {inParts ? ` ／ IN ${inParts}` : ''}
          </div>
          {bentoChip ? (
            <div className="mt-1">
              <span className="inline-block rounded-full bg-orange/[0.09] px-2 py-0.5 font-bold text-[0.72rem] text-orange-deep">
                🍱 {bentoChip}
              </span>
            </div>
          ) : null}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
    </Card>
  );
}

export function GuestList({
  guests,
  onOpen,
  bentoByGuest,
}: {
  guests: GuestRow[];
  onOpen: (id: string) => void;
  // guest.id → bento chip text. When passed, cards show a 🍱 chip for guests with
  // linked orders. Omitted where the caller has no bento data to show.
  bentoByGuest?: Map<string, string | null>;
}) {
  return (
    <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3 xl:grid-cols-3">
      {guests.map((guest) => (
        <GuestCard
          key={guest.id}
          guest={guest}
          onOpen={() => onOpen(guest.id)}
          bentoChip={bentoByGuest?.get(guest.id)}
        />
      ))}
    </div>
  );
}
