import { ChevronRight, Plus } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PhraseRow } from '../components/PhraseRow';
import { BackButton, EmptyState, NeedsInputBadge, Screen, SectionLabel } from '../components/ui';
import { KIND_META, LANG_LABEL } from '../content/kinds';
import { useContentByKind } from '../data/queries';
import { nowIso } from '../lib/date';
import { insertRow, serializeList, uuid } from '../lib/db';
import { useSession } from '../lib/session';

export function KnowledgeCategory() {
  const { kind = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentStaff } = useSession();
  const { data: allItems } = useContentByKind(kind);
  const meta = KIND_META[kind];
  const langFilter = searchParams.get('lang');
  const langs = [...new Set(allItems.map((item) => item.lang).filter(Boolean))] as string[];
  const items =
    kind === 'phrase' && langFilter
      ? allItems.filter((item) => item.lang === langFilter)
      : allItems;

  async function add() {
    const slug = `${kind}-${Date.now()}`;
    await insertRow('content', {
      id: uuid(),
      kind,
      slug,
      title: '',
      body: '',
      phase: null,
      lang: kind === 'phrase' ? 'en' : null,
      photo_paths: serializeList([]),
      status: 'needs_input',
      updated_by: currentStaff?.id ?? null,
      updated_at: nowIso(),
    });
    navigate(`/manual/c/${slug}`, { state: { edit: true } });
  }

  if (!meta) {
    return (
      <Screen>
        <BackButton onClick={() => navigate('/manual')}>ナレッジ</BackButton>
        <EmptyState>カテゴリが見つかりません。</EmptyState>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackButton onClick={() => navigate('/manual')}>ナレッジ</BackButton>
      <div className="flex items-center justify-between">
        <SectionLabel>{meta.label}</SectionLabel>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 rounded-full bg-green px-3 py-1.5 font-bold text-[0.74rem] text-cream"
        >
          <Plus size={14} /> 追加
        </button>
      </div>
      {meta.hint ? (
        <div className="mb-2 px-1 text-[0.78rem] text-ink-light">{meta.hint}</div>
      ) : null}
      {kind === 'phrase' && langs.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className={`min-h-[36px] rounded-full border px-3 text-[0.78rem] ${langFilter === null ? 'border-green bg-green/10 font-bold text-green' : 'border-line text-ink-light'}`}
          >
            すべて
          </button>
          {langs.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setSearchParams({ lang })}
              className={`min-h-[36px] rounded-full border px-3 text-[0.78rem] ${langFilter === lang ? 'border-green bg-green/10 font-bold text-green' : 'border-line text-ink-light'}`}
            >
              {LANG_LABEL[lang] ?? lang}
            </button>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState>まだ項目がありません。「追加」から最初の1件を作れます。</EmptyState>
      ) : kind === 'phrase' ? (
        <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3 xl:grid-cols-3">
          {items.map((item) => (
            <PhraseRow
              key={item.id}
              label={item.title ?? ''}
              text={item.body ?? ''}
              lang={item.lang ?? 'en'}
              onOpen={() => navigate(`/manual/c/${item.slug}`)}
            />
          ))}
        </div>
      ) : (
        <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = meta.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/manual/c/${item.slug}`)}
                className="mb-1.5 flex w-full items-center gap-2 rounded-[11px] border border-line bg-paper px-3 py-2.5 text-left text-[0.88rem]"
              >
                <Icon size={14} className="shrink-0 text-wood" />
                <span className="flex-1">{item.title || '（無題）'}</span>
                {item.status === 'needs_input' ? <NeedsInputBadge /> : null}
                <ChevronRight size={14} className="text-ink-mute" />
              </button>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
