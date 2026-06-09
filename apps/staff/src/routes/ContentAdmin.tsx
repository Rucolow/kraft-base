import { useQuery } from '@powersync/react';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BackButton,
  Badge,
  EmptyState,
  GhostButton,
  NeedsInputBadge,
  PrimaryButton,
  Screen,
  SectionLabel,
  Sheet,
  TextField,
} from '../components/ui';
import { nowIso } from '../lib/date';
import { insertRow, serializeList, updateRow, uuid } from '../lib/db';
import { db } from '../lib/powersync';
import type { ContentRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';

const KINDS = ['manual', 'location', 'procedure', 'area', 'emergency', 'price', 'phrase'] as const;

export function ContentAdmin() {
  const navigate = useNavigate();
  const { currentStaff, isOwner } = useSession();
  const { data: items } = useQuery<ContentRow>(
    'SELECT * FROM content ORDER BY kind, status DESC, title',
  );
  const [editing, setEditing] = useState<ContentRow | null>(null);

  if (!isOwner) {
    return (
      <Screen>
        <BackButton onClick={() => navigate('/manual')}>ナレッジ</BackButton>
        <EmptyState>コンテンツ編集はオーナー専用です。</EmptyState>
      </Screen>
    );
  }

  function startNew() {
    setEditing({
      id: uuid(),
      kind: 'manual',
      slug: `content-${Date.now()}`,
      title: '',
      body: '',
      phase: null,
      lang: null,
      photo_paths: serializeList([]),
      status: 'needs_input',
      updated_by: null,
      updated_at: null,
    });
  }

  return (
    <Screen>
      <BackButton onClick={() => navigate('/manual')}>ナレッジ</BackButton>
      <div className="flex items-center justify-between">
        <SectionLabel>コンテンツ編集</SectionLabel>
        <button
          type="button"
          onClick={startNew}
          className="flex items-center gap-1 rounded-full bg-green px-3 py-1.5 font-bold text-[0.74rem] text-cream"
        >
          <Plus size={14} /> 新規
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState>コンテンツはありません。</EmptyState>
      ) : (
        items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setEditing(item)}
            className="mb-1.5 flex w-full items-center gap-2 rounded-[11px] border border-line bg-paper px-3 py-2.5 text-left text-[0.88rem]"
          >
            <Badge tone="neutral">{item.kind}</Badge>
            <span className="flex-1">{item.title || '（無題）'}</span>
            {item.status === 'needs_input' ? <NeedsInputBadge /> : <Badge tone="ok">公開</Badge>}
          </button>
        ))
      )}

      {editing ? (
        <Editor
          key={editing.id}
          item={editing}
          staffId={currentStaff?.id ?? null}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Screen>
  );
}

function Editor({
  item,
  staffId,
  onClose,
}: {
  item: ContentRow;
  staffId: string | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item.title ?? '');
  const [body, setBody] = useState(item.body ?? '');
  const [kind, setKind] = useState(item.kind ?? 'manual');
  const [ready, setReady] = useState(item.status === 'ready');

  async function save() {
    const values = {
      kind,
      title: title.trim(),
      body,
      status: ready ? 'ready' : 'needs_input',
      updated_by: staffId,
      updated_at: nowIso(),
    };
    const exists = await db.getOptional<{ id: string }>('SELECT id FROM content WHERE id = ?', [
      item.id,
    ]);
    if (exists) {
      await updateRow('content', item.id, values);
    } else {
      await insertRow('content', {
        id: item.id,
        slug: item.slug,
        phase: item.phase,
        lang: item.lang,
        photo_paths: item.photo_paths ?? serializeList([]),
        ...values,
      });
    }
    onClose();
  }

  return (
    <Sheet title="コンテンツを編集" onClose={onClose}>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {KINDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={`rounded-full border px-2.5 py-1 text-[0.72rem] ${kind === option ? 'border-green bg-green/10 text-green' : 'border-line text-ink-light'}`}
          >
            {option}
          </button>
        ))}
      </div>
      <TextField
        label="タイトル"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label className="mb-3 block">
        <span className="mb-1 block text-[0.78rem] text-ink-light">本文</span>
        <textarea
          className="min-h-[120px] w-full rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-green-light"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={() => setReady((prev) => !prev)}
        className={`mb-3 min-h-[44px] w-full rounded-[11px] border text-[0.84rem] ${ready ? 'border-green bg-green/10 text-green' : 'border-orange bg-orange/10 text-orange-deep'}`}
      >
        {ready ? '公開（ready）' : '要確認（needs_input）'}
      </button>
      <PrimaryButton onClick={save}>保存</PrimaryButton>
      <div className="mt-2">
        <GhostButton onClick={onClose}>キャンセル</GhostButton>
      </div>
    </Sheet>
  );
}
