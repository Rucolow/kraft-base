import { useQuery } from '@powersync/react';
import { ChevronRight, CloudOff, Search, ShoppingBag, Sprout } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, EmptyState, NeedsInputBadge, Screen, SectionLabel } from '../components/ui';
import { KIND_META, KIND_ORDER } from '../content/kinds';
import { useOpenFollowups } from '../data/queries';
import type { ContentRow } from '../lib/powersync/schema';

interface KindCount {
  kind: string;
  total: number;
  needs: number;
}

export function ManualHub() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const q = query.trim();

  const { data: kindCounts } = useQuery<KindCount>(
    `SELECT kind, count(*) AS total,
            sum(CASE WHEN status = 'needs_input' THEN 1 ELSE 0 END) AS needs
       FROM content GROUP BY kind`,
  );
  const { data: followups } = useOpenFollowups();
  const { data: results } = useQuery<ContentRow>(
    q
      ? 'SELECT * FROM content WHERE title LIKE ? OR body LIKE ? ORDER BY kind, title LIMIT 30'
      : 'SELECT * FROM content WHERE 0',
    q ? [`%${q}%`, `%${q}%`] : [],
  );

  const counts = new Map(kindCounts.map((row) => [row.kind, row]));
  const needsTotal = kindCounts.reduce((sum, row) => sum + (row.needs ?? 0), 0);

  return (
    <Screen>
      <div className="relative mb-5">
        <Search size={18} className="-translate-y-1/2 absolute top-1/2 left-3.5 text-ink-mute" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="辞書を検索（例：火打石、バス、Wi-Fi）"
          className="min-h-[52px] w-full rounded-[14px] border border-line bg-paper py-3 pr-3 pl-11 text-base shadow-kb-sm outline-none focus:border-orange-light"
        />
      </div>

      {q ? (
        <>
          <SectionLabel>
            検索結果 — <span className="font-sans tabular-nums">{results.length}</span>件
          </SectionLabel>
          {results.length === 0 ? (
            <EmptyState>
              見つかりませんでした。カテゴリから追加して、辞書を育てられます。
            </EmptyState>
          ) : (
            <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3">
              {results.map((item) => {
                const meta = KIND_META[item.kind ?? ''];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(`/manual/c/${item.slug}`)}
                    className="mb-1.5 flex w-full items-center gap-2 rounded-[11px] border border-line bg-paper px-3 py-3 text-left text-[0.88rem]"
                  >
                    <Badge tone="neutral">{meta?.label ?? item.kind}</Badge>
                    <span className="flex-1">{item.title}</span>
                    {item.status === 'needs_input' ? <NeedsInputBadge /> : null}
                    <ChevronRight size={14} className="text-ink-mute" />
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {needsTotal + followups.length > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/manual/grow')}
              className="mb-5 flex w-full items-center gap-3 rounded-kb border border-orange/40 bg-orange/[0.06] p-4 text-left"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange/15 text-orange">
                <Sprout size={20} />
              </span>
              <span className="flex-1">
                <span className="font-bold text-[0.95rem] text-orange-deep">育てる項目</span>
                <span className="mt-0.5 block text-[0.78rem] text-ink-light">
                  未確定・空欄の項目があります。気づいた人がその場で埋めて育てます。
                </span>
              </span>
              <Badge tone="warn">{needsTotal + followups.length}</Badge>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => navigate('/manual/products')}
            className="mb-5 flex w-full items-center gap-3 rounded-kb border border-line bg-paper p-4 text-left shadow-kb-sm"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-orange/15 text-orange">
              <ShoppingBag size={20} />
            </span>
            <span className="flex-1">
              <span className="font-bold text-[0.95rem]">商品一覧（館内販売）</span>
              <span className="mt-0.5 block text-[0.78rem] text-ink-light">
                売価・原価・粗利。価格はオーナーが編集できます。
              </span>
            </span>
            <ChevronRight size={16} className="text-ink-mute" />
          </button>

          <SectionLabel>カテゴリ</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
            {KIND_ORDER.map((kind) => {
              const meta = KIND_META[kind];
              if (!meta) {
                return null;
              }
              const count = counts.get(kind);
              const Icon = meta.icon;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => navigate(`/manual/k/${kind}`)}
                  className="relative flex aspect-[4/3] flex-col items-start justify-between rounded-kb border border-line bg-paper p-3.5 text-left shadow-kb-sm active:scale-[0.985]"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-orange/15 text-orange">
                    <Icon size={20} />
                  </span>
                  <span>
                    <span className="block font-bold text-[0.95rem]">{meta.label}</span>
                    <span className="block text-[0.72rem] text-ink-mute tabular-nums">
                      {count?.total ?? 0}件
                    </span>
                  </span>
                  {(count?.needs ?? 0) > 0 ? (
                    <span className="absolute top-3 right-3">
                      <Badge tone="warn">{count?.needs}</Badge>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-1.5 px-1 text-[0.74rem] text-ink-mute">
            <CloudOff size={13} /> すべて端末に保存され、電波ゼロでも開けます。
          </div>
        </>
      )}
    </Screen>
  );
}
