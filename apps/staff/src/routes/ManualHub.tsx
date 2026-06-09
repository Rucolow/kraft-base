import {
  BookOpen,
  ChevronRight,
  CloudOff,
  MapPin,
  Package,
  PenSquare,
  Sparkles,
  Sprout,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PhraseRow } from '../components/PhraseRow';
import { Card, EmptyState, NeedsInputBadge, Screen, SectionLabel } from '../components/ui';
import { useContentByKind } from '../data/queries';
import { useSession } from '../lib/session';

const REFERENCE: Array<{ kind: string; label: string }> = [
  { kind: 'manual', label: 'マニュアル' },
  { kind: 'procedure', label: '手順' },
  { kind: 'area', label: '周辺案内' },
  { kind: 'emergency', label: '緊急・防災' },
  { kind: 'price', label: '価格' },
];

function ToolRow({
  icon: Icon,
  label,
  onClick,
}: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-2 flex w-full items-center gap-2.5 rounded-[11px] border border-line bg-paper px-3 py-3 text-left text-[0.9rem]"
    >
      <Icon size={16} className="text-green" />
      <span className="flex-1">{label}</span>
      <ChevronRight size={15} className="text-ink-mute" />
    </button>
  );
}

function KindList({ kind, label }: { kind: string; label: string }) {
  const navigate = useNavigate();
  const { data: items } = useContentByKind(kind);
  if (items.length === 0) {
    return null;
  }
  return (
    <>
      <SectionLabel>{label}</SectionLabel>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => navigate(`/manual/c/${item.slug}`)}
          className="mb-1.5 flex w-full items-center gap-2 rounded-[11px] border border-line bg-paper px-3 py-2.5 text-left text-[0.88rem]"
        >
          <BookOpen size={14} className="text-wood" />
          <span className="flex-1">{item.title}</span>
          {item.status === 'needs_input' ? <NeedsInputBadge /> : null}
          <ChevronRight size={14} className="text-ink-mute" />
        </button>
      ))}
    </>
  );
}

export function ManualHub() {
  const navigate = useNavigate();
  const { isOwner } = useSession();
  const { data: phrases } = useContentByKind('phrase');

  return (
    <Screen>
      <Card muted>
        <div className="mb-1.5 flex items-center gap-2">
          <CloudOff size={16} className="text-green" />
          <span className="font-bold text-[0.92rem] text-green">ナレッジ（オフライン対応）</span>
        </div>
        <div className="text-[0.82rem] text-ink-light">
          緊急連絡先・作法・会話集は電波ゼロでも開きます。
        </div>
      </Card>

      <ToolRow icon={MapPin} label="物の置き場所" onClick={() => navigate('/manual/locations')} />
      <ToolRow
        icon={Sprout}
        label="育てる項目（要確認）"
        onClick={() => navigate('/manual/grow')}
      />
      <ToolRow icon={Package} label="忘れ物" onClick={() => navigate('/manual/lost')} />
      <ToolRow icon={Wrench} label="設備・備品" onClick={() => navigate('/manual/equipment')} />
      {isOwner ? (
        <ToolRow
          icon={PenSquare}
          label="コンテンツ編集"
          onClick={() => navigate('/manual/admin')}
        />
      ) : null}

      <SectionLabel>
        <span className="flex items-center gap-1.5">
          <Sparkles size={13} /> 基本フレーズ
        </span>
      </SectionLabel>
      {phrases.length === 0 ? (
        <EmptyState>フレーズが未登録です。</EmptyState>
      ) : (
        phrases.map((phrase) => (
          <PhraseRow
            key={phrase.id}
            label={phrase.title ?? ''}
            text={phrase.body ?? ''}
            lang={phrase.lang ?? 'en'}
          />
        ))
      )}

      {REFERENCE.map((reference) => (
        <KindList key={reference.kind} kind={reference.kind} label={reference.label} />
      ))}
    </Screen>
  );
}
