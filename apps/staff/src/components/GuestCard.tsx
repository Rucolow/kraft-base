import { guestStatusMeta } from '../lib/guestStatus';
import type { GuestRow } from '../lib/powersync/schema';
import { Badge, Card } from './ui';

// Cancelled guests stay visible (greyed) but must not inflate headcounts used for
// prep — kept consistent with the home cockpit, which counts active guests only.
export const isActive = (guest: GuestRow) => guest.status !== 'cancelled';

export function GuestCard({ guest, onOpen }: { guest: GuestRow; onOpen: () => void }) {
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
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
    </Card>
  );
}

export function GuestList({
  guests,
  onOpen,
}: {
  guests: GuestRow[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3 xl:grid-cols-3">
      {guests.map((guest) => (
        <GuestCard key={guest.id} guest={guest} onOpen={() => onOpen(guest.id)} />
      ))}
    </div>
  );
}
