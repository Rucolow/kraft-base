import { ChevronRight, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BackButton, EmptyState, NeedsInputBadge, Screen, SectionLabel } from '../components/ui';
import { useContentByKind } from '../data/queries';

export function Locations() {
  const navigate = useNavigate();
  const { data: items } = useContentByKind('location');

  return (
    <Screen>
      <BackButton onClick={() => navigate('/manual')}>ナレッジ</BackButton>
      <SectionLabel>物の置き場所</SectionLabel>
      <div className="mb-2 px-1 text-[0.78rem] text-ink-light">
        新人が「探して止まる」を解消する面。写真と場所はオーナーが運用中に育てます。
      </div>
      {items.length === 0 ? (
        <EmptyState>項目が未登録です。</EmptyState>
      ) : (
        items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(`/manual/c/${item.slug}`)}
            className="mb-1.5 flex w-full items-center gap-2 rounded-[11px] border border-line bg-paper px-3 py-3 text-left text-[0.9rem]"
          >
            <MapPin size={15} className="text-wood" />
            <span className="flex-1">{item.title}</span>
            {item.status === 'needs_input' ? <NeedsInputBadge /> : null}
            <ChevronRight size={14} className="text-ink-mute" />
          </button>
        ))
      )}
    </Screen>
  );
}
