import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BackButton,
  Badge,
  EmptyState,
  NeedsInputBadge,
  Screen,
  SectionLabel,
} from '../components/ui';
import { useGrowItems, useOpenFollowups } from '../data/queries';
import { nowIso } from '../lib/date';
import { boolToInt, insertRow, uuid } from '../lib/db';
import { useSession } from '../lib/session';

const KIND_LABEL: Record<string, string> = {
  manual: 'マニュアル',
  location: '物の置き場所',
  procedure: '手順',
  area: '周辺案内',
  emergency: '緊急・防災',
  price: '価格',
  phrase: 'フレーズ',
};

export function Growlist() {
  const navigate = useNavigate();
  const { currentStaff } = useSession();
  const { data: items } = useGrowItems();
  const { data: followups } = useOpenFollowups();
  const [draft, setDraft] = useState('');

  async function raise() {
    if (!draft.trim()) {
      return;
    }
    await insertRow('followup', {
      id: uuid(),
      body: draft.trim(),
      guest_id: null,
      status: 'open',
      requires_owner: boolToInt(true),
      created_by: currentStaff?.id ?? null,
      created_at: nowIso(),
      resolved_at: null,
    });
    setDraft('');
  }

  return (
    <Screen>
      <BackButton onClick={() => navigate('/manual')}>ナレッジ</BackButton>
      <div className="mb-2 px-1 text-[0.78rem] text-ink-light">
        運用で埋めるべきものの実行中リスト。「分からない／空」を起票して育てに参加できます。
      </div>

      <SectionLabel>要確認コンテンツ</SectionLabel>
      {items.length === 0 ? (
        <EmptyState>要確認の項目はありません。</EmptyState>
      ) : (
        items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(`/manual/c/${item.slug}`)}
            className="mb-1.5 flex w-full items-center gap-2 rounded-[11px] border border-line bg-paper px-3 py-2.5 text-left text-[0.88rem]"
          >
            <Badge tone="neutral">{KIND_LABEL[item.kind ?? ''] ?? item.kind}</Badge>
            <span className="flex-1">{item.title}</span>
            <NeedsInputBadge />
            <ChevronRight size={14} className="text-ink-mute" />
          </button>
        ))
      )}

      <SectionLabel>申し送り（未完）</SectionLabel>
      {followups.length === 0 ? (
        <EmptyState>未完の申し送りはありません。</EmptyState>
      ) : (
        followups.map((followup) => (
          <div
            key={followup.id}
            className="mb-1.5 rounded-[11px] border border-line bg-paper px-3 py-2.5 text-[0.88rem]"
          >
            {followup.body}
            {followup.requires_owner === 1 ? (
              <span className="ml-1.5 align-middle">
                <Badge tone="wood">オーナー</Badge>
              </span>
            ) : null}
          </div>
        ))
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          className="min-h-[44px] flex-1 rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-green-light"
          placeholder="分からない／空を起票…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          aria-label="起票"
          onClick={raise}
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[11px] bg-green text-paper"
        >
          <Plus size={18} />
        </button>
      </div>
    </Screen>
  );
}
