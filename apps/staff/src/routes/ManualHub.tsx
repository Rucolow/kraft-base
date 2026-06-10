import { useQuery } from '@powersync/react';
import { ChevronRight, CloudOff, Package, Search, Sprout, Wrench } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Card,
  CardHead,
  EmptyState,
  NeedsInputBadge,
  Screen,
  SectionLabel,
} from '../components/ui';
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
      <div className="relative mb-4">
        <Search size={16} className="-translate-y-1/2 absolute top-1/2 left-3 text-ink-mute" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ナレッジを検索（例：火打石、バス、Wi-Fi）"
          className="min-h-[48px] w-full rounded-[14px] border border-line bg-paper py-2.5 pr-3 pl-9 text-base shadow-kb-sm outline-none focus:border-green-light"
        />
      </div>

      {q ? (
        <>
          <SectionLabel>
            検索結果 — <span className="font-sans tabular-nums">{results.length}</span>件
          </SectionLabel>
          {results.length === 0 ? (
            <EmptyState>
              見つかりませんでした。カテゴリから追加して、ナレッジを育てられます。
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
                    className="mb-1.5 flex w-full items-center gap-2 rounded-[11px] border border-line bg-paper px-3 py-2.5 text-left text-[0.88rem]"
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
          <Card primary onClick={() => navigate('/manual/grow')}>
            <CardHead
              icon={<Sprout size={17} />}
              tone="orange"
              title="育てる項目（要確認）"
              trailing={<Badge tone="warn">{needsTotal + followups.length}件</Badge>}
            />
            <div className="text-[0.86rem] text-ink-light">
              未確定・空欄のナレッジと未完の申し送り。気づいた人がその場で埋めて育てます。
            </div>
          </Card>

          <SectionLabel>カテゴリ</SectionLabel>
          <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3 xl:grid-cols-3">
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
                  className="mb-2 flex w-full items-center gap-2.5 rounded-[13px] border border-line bg-paper px-3.5 py-3.5 text-left shadow-kb-sm"
                >
                  <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-green/10 text-green">
                    <Icon size={17} />
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold text-[0.92rem]">{meta.label}</span>
                    <span className="block text-[0.72rem] text-ink-mute tabular-nums">
                      {count?.total ?? 0}件
                    </span>
                  </span>
                  {(count?.needs ?? 0) > 0 ? <Badge tone="warn">{count?.needs}</Badge> : null}
                  <ChevronRight size={15} className="text-ink-mute" />
                </button>
              );
            })}
          </div>

          <SectionLabel>台帳</SectionLabel>
          <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3">
            <button
              type="button"
              onClick={() => navigate('/manual/lost')}
              className="mb-2 flex w-full items-center gap-2.5 rounded-[11px] border border-line bg-paper px-3 py-3 text-left text-[0.9rem]"
            >
              <Package size={16} className="text-green" />
              <span className="flex-1">忘れ物</span>
              <ChevronRight size={15} className="text-ink-mute" />
            </button>
            <button
              type="button"
              onClick={() => navigate('/manual/equipment')}
              className="mb-2 flex w-full items-center gap-2.5 rounded-[11px] border border-line bg-paper px-3 py-3 text-left text-[0.9rem]"
            >
              <Wrench size={16} className="text-green" />
              <span className="flex-1">設備・備品</span>
              <ChevronRight size={15} className="text-ink-mute" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-1.5 px-1 text-[0.74rem] text-ink-mute">
            <CloudOff size={13} /> すべて端末に保存され、電波ゼロでも開けます。
          </div>
        </>
      )}
    </Screen>
  );
}
