import { useQuery } from '@powersync/react';
import { ClipboardPen, Languages, Pencil, Pin, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { BackButton, Badge, Card, EmptyState, Screen, SectionLabel } from '../components/ui';
import { LANG_LABEL } from '../content/kinds';
import { useGuest, useGuestNotes } from '../data/queries';
import { nowIso } from '../lib/date';
import { boolToInt, insertRow, parseList, serializeList, updateRow, uuid } from '../lib/db';
import { useSession } from '../lib/session';

const STATUS_NEXT: Record<string, string> = {
  expected: 'arrived',
  arrived: 'late',
  late: 'arrived',
};
const STATUS_LABEL: Record<string, string> = { expected: '予定', arrived: '到着済', late: '遅着' };

export function GuestDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { currentStaff, staff, isOwner } = useSession();
  const { data: guests } = useGuest(id);
  const { data: notes } = useGuestNotes(id);
  const { data: registers } = useQuery<{ id: string }>(
    'SELECT id FROM checkin_record WHERE guest_id = ? LIMIT 1',
    [id],
  );
  const { data: phraseLangs } = useQuery<{ lang: string }>(
    "SELECT DISTINCT lang FROM content WHERE kind = 'phrase' AND lang IS NOT NULL ORDER BY lang",
  );
  const guest = guests[0] ?? null;

  const [memo, setMemo] = useState('');
  const [comment, setComment] = useState('');
  const [mentionIds, setMentionIds] = useState<string[]>([]);

  // Mark mentions to me as read on open (spec §6 "you" queue).
  useEffect(() => {
    if (!currentStaff) {
      return;
    }
    for (const note of notes) {
      const mentions = parseList(note.mentions);
      const readBy = parseList(note.read_by);
      if (mentions.includes(currentStaff.id) && !readBy.includes(currentStaff.id)) {
        updateRow('guest_note', note.id, {
          read_by: serializeList([...readBy, currentStaff.id]),
        });
      }
    }
  }, [notes, currentStaff]);

  if (!guest) {
    return (
      <Screen>
        <BackButton onClick={() => navigate('/guests')}>本日のゲスト</BackButton>
        <EmptyState>ゲストが見つかりません。</EmptyState>
      </Screen>
    );
  }

  const registered = registers.length > 0;
  const pinned = notes.filter((note) => note.pinned === 1);
  const comments = notes.filter((note) => note.pinned !== 1);
  const langs = [...phraseLangs.map((row) => row.lang)].sort((a, b) =>
    a === guest.language ? -1 : b === guest.language ? 1 : 0,
  );

  async function addNote(body: string, isPinned: boolean, mentions: string[]) {
    if (!body.trim()) {
      return;
    }
    await insertRow('guest_note', {
      id: uuid(),
      guest_id: id,
      author_id: currentStaff?.id ?? null,
      body: body.trim(),
      pinned: boolToInt(isPinned),
      mentions: serializeList(mentions),
      read_by: serializeList(currentStaff ? [currentStaff.id] : []),
      created_at: nowIso(),
    });
  }

  const info: Array<[string, string]> = [
    ['宿泊日', guest.stay_date ?? '—'],
    ['国', guest.country ?? '—'],
    ['言語', LANG_LABEL[guest.language ?? ''] ?? guest.language ?? '—'],
    ['人数', `${guest.party_size ?? 1}名`],
    ['チェックイン', guest.checkin_time ?? '—'],
    ['ベッド', guest.bed ?? '—'],
    ['弁当', guest.bento ?? '—'],
  ];

  return (
    <Screen>
      <BackButton onClick={() => navigate('/guests')}>本日のゲスト</BackButton>

      <div className="mb-4 border-line border-b pb-3.5">
        <div className="flex items-start gap-2.5">
          <div className="flex-1 font-bold text-[1.3rem] leading-tight">{guest.name}</div>
          <button
            type="button"
            onClick={() =>
              updateRow('guest', guest.id, {
                status: STATUS_NEXT[guest.status ?? 'expected'] ?? 'arrived',
              })
            }
          >
            <Badge tone={guest.status === 'arrived' ? 'ok' : 'warn'}>
              {STATUS_LABEL[guest.status ?? 'expected']}
            </Badge>
          </button>
          {isOwner ? (
            <button
              type="button"
              onClick={() => navigate(`/guests/${guest.id}/edit`)}
              className="text-orange"
            >
              <Pencil size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <SectionLabel>基本情報</SectionLabel>
      <div className="mb-3 grid grid-cols-[110px_1fr] overflow-hidden rounded-[13px] border border-line md:grid-cols-[110px_1fr_110px_1fr]">
        {info.map(([key, value]) => (
          <div key={key} className="contents">
            <div className="border-line border-b bg-cream px-3 py-2.5 font-semibold text-[0.78rem] text-orange">
              {key}
            </div>
            <div className="border-line border-b px-3 py-2.5 text-[0.88rem]">{value}</div>
          </div>
        ))}
        <div className="bg-cream px-3 py-2.5 font-semibold text-[0.78rem] text-orange">名簿</div>
        <div className="px-3 py-2.5 text-[0.88rem] md:col-span-3">
          {registered ? <Badge tone="ok">記入済み</Badge> : <Badge tone="warn">未記入</Badge>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/checkin/${guest.id}`)}
        className="mb-1 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[13px] bg-orange font-bold text-[0.92rem] text-green-deep shadow-kb"
      >
        <ClipboardPen size={17} />
        チェックイン入力（iPadをゲストに渡す）
      </button>

      <SectionLabel>メモ</SectionLabel>
      <Card>
        {pinned.length === 0 ? (
          <EmptyState>メモはありません。</EmptyState>
        ) : (
          pinned.map((note) => (
            <div
              key={note.id}
              className="flex items-start gap-2 border-line border-b py-2.5 last:border-none"
            >
              <Pin size={13} className="mt-1 shrink-0 text-wood" />
              <span className="text-[0.9rem]">{note.body}</span>
            </div>
          ))
        )}
      </Card>
      <div className="flex items-center gap-2">
        <input
          className="min-h-[44px] flex-1 rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-orange-light"
          placeholder="メモを追加…"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
        <button
          type="button"
          aria-label="メモを追加"
          onClick={() => addNote(memo, true, []).then(() => setMemo(''))}
          className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[11px] bg-orange text-green-deep"
        >
          <Pin size={17} />
        </button>
      </div>

      <SectionLabel>スレッド</SectionLabel>
      {comments.length === 0 ? (
        <EmptyState>まだやり取りはありません。</EmptyState>
      ) : (
        comments.map((note) => {
          const author = staff.find((member) => member.id === note.author_id) ?? null;
          const readers = parseList(note.read_by)
            .map((readerId) => staff.find((member) => member.id === readerId)?.name)
            .filter(Boolean);
          return (
            <div key={note.id} className="mb-1.5 rounded-[13px] bg-cream px-3 py-2.5">
              <div className="mb-0.5 font-semibold text-[0.68rem] text-ink-mute">
                {author?.name ?? '—'}
              </div>
              <div className="text-[0.86rem]">{note.body}</div>
              {readers.length > 0 ? (
                <div className="mt-1 text-[0.64rem] text-orange-light">
                  既読 {readers.join('・')}
                </div>
              ) : null}
            </div>
          );
        })
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {staff
          .filter((member) => member.id !== currentStaff?.id)
          .map((member) => {
            const active = mentionIds.includes(member.id);
            return (
              <button
                key={member.id}
                type="button"
                onClick={() =>
                  setMentionIds((prev) =>
                    active ? prev.filter((mid) => mid !== member.id) : [...prev, member.id],
                  )
                }
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[0.72rem] ${active ? 'border-orange bg-orange/10 text-orange-deep' : 'border-line text-ink-light'}`}
              >
                <Avatar staff={member} size={18} /> @{member.name}
              </button>
            );
          })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          className="min-h-[44px] flex-1 rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-orange-light"
          placeholder="このゲストについて残す…"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <button
          type="button"
          aria-label="送信"
          onClick={() =>
            addNote(comment, false, mentionIds).then(() => {
              setComment('');
              setMentionIds([]);
            })
          }
          className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[11px] bg-orange text-green-deep"
        >
          <Send size={17} />
        </button>
      </div>

      <SectionLabel>
        <span className="flex items-center gap-1.5">
          <Languages size={13} /> フレーズ集
        </span>
      </SectionLabel>
      <div className="flex flex-wrap gap-2">
        {langs.length === 0 ? (
          <EmptyState>フレーズが未登録です。</EmptyState>
        ) : (
          langs.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => navigate(`/manual/k/phrase?lang=${lang}`)}
              className={`min-h-[40px] rounded-full border px-4 text-[0.84rem] ${lang === guest.language ? 'border-orange bg-orange/15 font-bold text-orange' : 'border-line text-ink-light'}`}
            >
              {LANG_LABEL[lang] ?? lang}
            </button>
          ))
        )}
      </div>
    </Screen>
  );
}
