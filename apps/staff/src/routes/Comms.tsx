import { useQuery } from '@powersync/react';
import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { EmptyState, Screen, SectionLabel } from '../components/ui';
import { useMentions } from '../data/queries';
import { shiftBoundaryIso } from '../lib/date';
import { parseList, serializeList, updateRow } from '../lib/db';
import type { ShiftSessionRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';

export function Comms() {
  const navigate = useNavigate();
  const { currentStaff, staff } = useSession();
  const { data: mentions } = useMentions(currentStaff?.id ?? null);
  const { data: present } = useQuery<ShiftSessionRow>(
    'SELECT * FROM shift_session WHERE ended_at IS NULL AND started_at >= ? ORDER BY started_at DESC',
    [shiftBoundaryIso()],
  );

  function open(noteId: string, readBy: string, guestId: string | null) {
    if (currentStaff) {
      const readers = parseList(readBy);
      if (!readers.includes(currentStaff.id)) {
        updateRow('guest_note', noteId, { read_by: serializeList([...readers, currentStaff.id]) });
      }
    }
    if (guestId) {
      navigate(`/guests/${guestId}`);
    }
  }

  return (
    <Screen>
      <SectionLabel>いま稼働中</SectionLabel>
      {present.length === 0 ? (
        <EmptyState>稼働中のシフトはありません。</EmptyState>
      ) : (
        <div className="mb-2 flex flex-wrap gap-2">
          {present.map((session) => {
            const member = staff.find((person) => person.id === session.staff_id) ?? null;
            return (
              <span
                key={session.id}
                className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1.5 text-[0.78rem]"
              >
                <Avatar staff={member} size={20} /> {member?.name ?? '—'}
              </span>
            );
          })}
        </div>
      )}

      <SectionLabel>あなた宛て</SectionLabel>
      {mentions.length === 0 ? (
        <EmptyState>確認待ちの @メンションはありません。</EmptyState>
      ) : (
        mentions.map((note) => {
          const author = staff.find((person) => person.id === note.author_id) ?? null;
          return (
            <button
              key={note.id}
              type="button"
              onClick={() => open(note.id, note.read_by ?? serializeList([]), note.guest_id)}
              className="mb-2.5 flex w-full items-start gap-2.5 rounded-[13px] border border-line bg-paper p-3 text-left"
            >
              <Avatar staff={author} size={34} />
              <div className="flex-1">
                <div className="text-[0.87rem]">{note.body}</div>
                <div className="mt-1 flex items-center gap-1 font-bold text-[0.7rem] text-orange-deep">
                  <ChevronRight size={11} /> 開く
                </div>
              </div>
            </button>
          );
        })
      )}
    </Screen>
  );
}
