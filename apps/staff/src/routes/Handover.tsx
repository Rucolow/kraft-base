import { AlertTriangle, Check, ChevronRight, Pin, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useOpenFollowups, useTimeline } from '../data/queries';
import { formatClock, nowIso } from '../lib/date';
import { boolToInt, insertRow, updateRow, uuid } from '../lib/db';
import { useSession } from '../lib/session';

export function Handover() {
  const navigate = useNavigate();
  const { currentStaff, staff } = useSession();
  const { data: followups } = useOpenFollowups();
  const { data: timeline } = useTimeline();

  const [followupText, setFollowupText] = useState('');
  const [requiresOwner, setRequiresOwner] = useState(false);
  const [entryText, setEntryText] = useState('');

  async function addFollowup() {
    if (!followupText.trim()) {
      return;
    }
    await insertRow('followup', {
      id: uuid(),
      body: followupText.trim(),
      guest_id: null,
      status: 'open',
      requires_owner: boolToInt(requiresOwner),
      created_by: currentStaff?.id ?? null,
      created_at: nowIso(),
      resolved_at: null,
    });
    setFollowupText('');
    setRequiresOwner(false);
  }

  async function addEntry() {
    if (!entryText.trim()) {
      return;
    }
    await insertRow('timeline_entry', {
      id: uuid(),
      author_id: currentStaff?.id ?? null,
      kind: 'note',
      body: entryText.trim(),
      ref_type: null,
      ref_id: null,
      created_at: nowIso(),
    });
    setEntryText('');
  }

  return (
    <Screen>
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
        <div>
          <SectionLabel>
            <span className="flex items-center gap-1.5">
              <Pin size={12} /> 未完・申し送り
            </span>
          </SectionLabel>
          {followups.length === 0 ? (
            <EmptyState>未完の申し送りはありません。</EmptyState>
          ) : (
            followups.map((followup) => (
              <div
                key={followup.id}
                className="mb-2.5 flex items-start gap-2.5 rounded-[13px] border-orange border-l-[3px] bg-orange/[0.07] px-3.5 py-3"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-orange" />
                <button
                  type="button"
                  className="flex-1 text-left text-[0.86rem]"
                  onClick={() => followup.guest_id && navigate(`/guests/${followup.guest_id}`)}
                >
                  {followup.body}
                  {followup.requires_owner === 1 ? (
                    <span className="ml-1.5 align-middle">
                      <Badge tone="wood">オーナー</Badge>
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  aria-label="完了にする"
                  onClick={() =>
                    updateRow('followup', followup.id, { status: 'done', resolved_at: nowIso() })
                  }
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-orange"
                >
                  <Check size={15} />
                </button>
                {followup.guest_id ? (
                  <ChevronRight size={15} className="mt-1 text-ink-mute" />
                ) : null}
              </div>
            ))
          )}

          <div className="mb-2 flex items-center gap-2">
            <input
              className="min-h-[44px] flex-1 rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-orange-light"
              placeholder="申し送りを追加…"
              value={followupText}
              onChange={(event) => setFollowupText(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setRequiresOwner((prev) => !prev)}
              className={`min-h-[44px] rounded-[11px] border px-2.5 text-[0.72rem] ${requiresOwner ? 'border-wood bg-wood/10 text-wood' : 'border-line text-ink-light'}`}
            >
              オーナー宛
            </button>
            <button
              type="button"
              aria-label="申し送りを追加"
              onClick={addFollowup}
              className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[11px] bg-orange text-green-deep"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div>
          <SectionLabel>タイムライン</SectionLabel>
          <div className="mb-3 px-0.5 text-[0.78rem] text-ink-light">
            シフト中の記録がそのまま積み上がります。引き継ぎは書類ではなく、この履歴です。
          </div>
          <div className="relative ml-1.5 border-line border-l pl-5">
            {timeline.length === 0 ? (
              <EmptyState>まだ記録はありません。</EmptyState>
            ) : (
              timeline.map((entry) => {
                const author = staff.find((member) => member.id === entry.author_id) ?? null;
                return (
                  <div key={entry.id} className="relative pb-4">
                    <span
                      className="-left-[26px] absolute top-1 h-2.5 w-2.5 rounded-full border-2 bg-paper"
                      style={{ borderColor: author?.accent ?? '#c4a35a' }}
                    />
                    <div className="font-semibold text-[0.74rem] text-wood tabular-nums">
                      {entry.created_at ? formatClock(entry.created_at) : ''}
                    </div>
                    <div className="mt-0.5 text-[0.88rem]">{entry.body}</div>
                    <div className="mt-0.5 text-[0.72rem] text-ink-mute">{author?.name ?? '—'}</div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <input
              className="min-h-[44px] flex-1 rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-orange-light"
              placeholder="記録を残す…"
              value={entryText}
              onChange={(event) => setEntryText(event.target.value)}
            />
            <button
              type="button"
              aria-label="記録を追加"
              onClick={addEntry}
              className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[11px] bg-orange text-green-deep"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    </Screen>
  );
}
