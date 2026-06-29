import { Camera, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
import { insertRow, parseList, serializeList, updateRow, uuid } from '../lib/db';
import type { ContentRow, StaffRow } from '../lib/powersync/schema';
import { useSession } from '../lib/session';
import { photoSrc, storePhoto } from '../lib/storage';

export function ContentReader() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentStaff, staff } = useSession();
  const { data } = useContentBySlug(slug);
  const state = location.state as {
    edit?: boolean;
    draft?: { kind: string; slug: string; lang: string | null };
  } | null;
  const existing = data[0] ?? null;
  const draft = state?.draft ?? null;
  // A draft (from "add") has no DB row yet; render a synthetic item and insert on
  // first save so a cancelled new entry leaves no orphan row.
  const isNew = !existing && !!draft;
  const item: ContentRow | null =
    existing ??
    (draft
      ? ({
          id: '',
          kind: draft.kind,
          slug: draft.slug,
          title: '',
          body: '',
          phase: null,
          lang: draft.lang,
          photo_paths: serializeList([]),
          status: 'needs_input',
          updated_by: null,
          updated_at: null,
        } as ContentRow)
      : null);
  const [editing, setEditing] = useState(isNew || Boolean(state?.edit));

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
        <Editor
          item={item}
          isNew={isNew}
          staffId={currentStaff?.id ?? null}
          onSaved={() => {
            setEditing(false);
            // Clear the draft state so the now-saved row renders as the reader.
            if (isNew) {
              navigate(`/manual/c/${item.slug}`, { replace: true, state: {} });
            }
          }}
          onCancel={() => (isNew ? navigate(-1) : setEditing(false))}
        />
      </Screen>
    );
  }

  const meta = KIND_META[item.kind ?? ''];
  const editor = staff.find((member: StaffRow) => member.id === item.updated_by) ?? null;
  const updatedDate = item.updated_at
    ? new Date(item.updated_at).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
    : null;
  const photos = parseList(item.photo_paths)
    .map((value) => photoSrc(value))
    .filter((src): src is string => src !== null);

  return (
    <Screen>
      <BackButton onClick={() => navigate(-1)}>戻る</BackButton>
      <div className="flex items-start gap-2">
        <h1 className="flex-1 font-bold text-[1.2rem] text-orange">{item.title || '（無題）'}</h1>
        {item.status === 'needs_input' ? <NeedsInputBadge /> : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex min-h-[36px] items-center gap-1 rounded-full border border-line px-3 font-bold text-[0.74rem] text-orange"
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

      {photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
          {photos.map((src) => (
            <img
              key={src.slice(-40)}
              src={src}
              alt={item.title ?? ''}
              className="aspect-[4/3] w-full rounded-[12px] border border-line object-cover"
            />
          ))}
        </div>
      ) : null}

      {item.kind === 'phrase' ? (
        <div className="mt-4">
          <PhraseRow label={item.title ?? ''} text={item.body ?? ''} lang={item.lang ?? 'en'} />
        </div>
      ) : item.body ? (
        <p className="mt-3 whitespace-pre-wrap text-[0.92rem] leading-relaxed">{item.body}</p>
      ) : photos.length === 0 ? (
        <EmptyState>本文は未入力です。「編集」から、気づいた人がその場で書き足せます。</EmptyState>
      ) : null}
    </Screen>
  );
}

function Editor({
  item,
  isNew,
  staffId,
  onSaved,
  onCancel,
}: {
  item: ContentRow;
  isNew: boolean;
  staffId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title ?? '');
  const [body, setBody] = useState(item.body ?? '');
  const [lang, setLang] = useState(item.lang ?? 'en');
  const [ready, setReady] = useState(item.status === 'ready');
  const [photos, setPhotos] = useState<string[]>(() => parseList(item.photo_paths));
  const [saving, setSaving] = useState(false);
  const isPhrase = item.kind === 'phrase';

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    const value = await storePhoto(file);
    setPhotos((prev) => [...prev, value]);
  }

  async function save() {
    if (saving) {
      return;
    }
    setSaving(true);
    const values = {
      title: title.trim(),
      body,
      lang: isPhrase ? lang.trim() || 'en' : item.lang,
      photo_paths: serializeList(photos),
      status: ready ? 'ready' : 'needs_input',
      updated_by: staffId,
      updated_at: nowIso(),
    };
    if (isNew) {
      await insertRow('content', {
        id: uuid(),
        kind: item.kind,
        slug: item.slug,
        phase: item.phase ?? null,
        ...values,
      });
    } else {
      await updateRow('content', item.id, values);
    }
    onSaved();
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
          className="min-h-[160px] w-full rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-orange-light"
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

      <span className="mb-1 block text-[0.78rem] text-ink-light">写真</span>
      <div className="mb-3 grid grid-cols-3 gap-2 md:grid-cols-4">
        {photos.map((value, index) => {
          const src = photoSrc(value);
          return (
            <div key={value.slice(-40)} className="relative">
              {src ? (
                <img
                  src={src}
                  alt={`添付 ${index + 1}`}
                  className="aspect-[4/3] w-full rounded-[10px] border border-line object-cover"
                />
              ) : (
                <div className="grid aspect-[4/3] w-full place-items-center rounded-[10px] border border-line bg-cream text-[0.7rem] text-ink-mute">
                  同期後に表示
                </div>
              )}
              <button
                type="button"
                aria-label="写真を削除"
                onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                className="-top-1.5 -right-1.5 absolute grid h-6 w-6 place-items-center rounded-full bg-ink text-paper"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
        <label className="grid aspect-[4/3] w-full cursor-pointer place-items-center rounded-[10px] border border-line border-dashed text-ink-light">
          <span className="flex flex-col items-center gap-1 text-[0.7rem]">
            <Camera size={18} />
            撮る／選ぶ
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPick}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => setReady((prev) => !prev)}
        className={`mb-3 min-h-[44px] w-full rounded-[11px] border text-[0.84rem] ${ready ? 'border-orange bg-orange/15 text-orange' : 'border-orange bg-orange/10 text-orange-deep'}`}
      >
        {ready ? '確定（みんなに公開してOK）' : '要確認（まだ育て中）'}
      </button>
      <PrimaryButton onClick={save} disabled={saving}>
        保存
      </PrimaryButton>
      <div className="mt-2">
        <GhostButton onClick={onCancel}>キャンセル</GhostButton>
      </div>
    </>
  );
}
