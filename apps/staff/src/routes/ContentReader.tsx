import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { PhraseRow } from '../components/PhraseRow';
import {
  BackButton,
  Badge,
  EmptyState,
  GhostButton,
  NeedsInputBadge,
  PrimaryButton,
  Screen,
  TextField,
} from '../components/ui';
import { KIND_META } from '../content/kinds';
import { useContentBySlug } from '../data/queries';
import { nowIso } from '../lib/date';
import { updateRow } from '../lib/db';
import type { ContentRow, StaffRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';

export function ContentReader() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentStaff, staff } = useSession();
  const { data } = useContentBySlug(slug);
  const item = data[0] ?? null;
  const [editing, setEditing] = useState(
    Boolean((location.state as { edit?: boolean } | null)?.edit),
  );

  if (!item) {
    return (
      <Screen>
        <BackButton onClick={() => navigate(-1)}>戻る</BackButton>
        <EmptyState>コンテンツが見つかりません。</EmptyState>
      </Screen>
    );
  }

  if (editing) {
    return (
      <Screen>
        <BackButton onClick={() => navigate(-1)}>戻る</BackButton>
        <Editor item={item} staffId={currentStaff?.id ?? null} onClose={() => setEditing(false)} />
      </Screen>
    );
  }

  const meta = KIND_META[item.kind ?? ''];
  const editor = staff.find((member: StaffRow) => member.id === item.updated_by) ?? null;
  const updatedDate = item.updated_at
    ? new Date(item.updated_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : null;

  return (
    <Screen>
      <BackButton onClick={() => navigate(-1)}>戻る</BackButton>
      <div className="flex items-start gap-2">
        <h1 className="flex-1 font-bold text-[1.2rem] text-green">{item.title || '（無題）'}</h1>
        {item.status === 'needs_input' ? <NeedsInputBadge /> : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex min-h-[36px] items-center gap-1 rounded-full border border-line px-3 font-bold text-[0.74rem] text-green"
        >
          <Pencil size={13} /> 編集
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[0.72rem] text-ink-mute">
        {meta ? <Badge tone="neutral">{meta.label}</Badge> : null}
        {editor ? (
          <span>
            更新：{editor.name}
            {updatedDate ? <span className="tabular-nums">（{updatedDate}）</span> : null}
          </span>
        ) : null}
      </div>

      {item.kind === 'phrase' ? (
        <div className="mt-4">
          <PhraseRow label={item.title ?? ''} text={item.body ?? ''} lang={item.lang ?? 'en'} />
        </div>
      ) : item.body ? (
        <p className="mt-3 whitespace-pre-wrap text-[0.92rem] leading-relaxed">{item.body}</p>
      ) : (
        <EmptyState>本文は未入力です。「編集」から、気づいた人がその場で書き足せます。</EmptyState>
      )}
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
  const [lang, setLang] = useState(item.lang ?? 'en');
  const [ready, setReady] = useState(item.status === 'ready');
  const isPhrase = item.kind === 'phrase';

  async function save() {
    await updateRow('content', item.id, {
      title: title.trim(),
      body,
      lang: isPhrase ? lang.trim() || 'en' : item.lang,
      status: ready ? 'ready' : 'needs_input',
      updated_by: staffId,
      updated_at: nowIso(),
    });
    onClose();
  }

  return (
    <>
      <TextField
        label={isPhrase ? '日本語（場面・意味）' : 'タイトル'}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label className="mb-3 block">
        <span className="mb-1 block text-[0.78rem] text-ink-light">
          {isPhrase ? 'フレーズ（読み上げる文）' : '本文'}
        </span>
        <textarea
          className="min-h-[160px] w-full rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-green-light"
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      {isPhrase ? (
        <TextField
          label="言語コード（en / de / it …）"
          value={lang}
          onChange={(event) => setLang(event.target.value)}
        />
      ) : null}
      <button
        type="button"
        onClick={() => setReady((prev) => !prev)}
        className={`mb-3 min-h-[44px] w-full rounded-[11px] border text-[0.84rem] ${ready ? 'border-green bg-green/10 text-green' : 'border-orange bg-orange/10 text-orange-deep'}`}
      >
        {ready ? '確定（みんなに公開してOK）' : '要確認（まだ育て中）'}
      </button>
      <PrimaryButton onClick={save}>保存</PrimaryButton>
      <div className="mt-2">
        <GhostButton onClick={onClose}>キャンセル</GhostButton>
      </div>
    </>
  );
}
