import { Camera, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BackButton, Badge, Card, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useEquipmentIssues } from '../data/queries';
import { nowIso } from '../lib/date';
import { insertRow, updateRow, uuid } from '../lib/db';
import { useSession } from '../lib/session';
import { photoSrc, storePhoto } from '../lib/storage';

const FLOW: Record<string, string> = { open: 'ordered', ordered: 'resolved', resolved: 'open' };
const LABEL: Record<string, string> = { open: '未対応', ordered: '発注済', resolved: '解決' };

export function Equipment() {
  const navigate = useNavigate();
  const { currentStaff } = useSession();
  const { data: issues } = useEquipmentIssues();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'fault' | 'restock'>('fault');
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setPhotoPath(await storePhoto(file));
    }
  }

  async function add() {
    if (!title.trim()) {
      return;
    }
    await insertRow('equipment_issue', {
      id: uuid(),
      kind,
      title: title.trim(),
      photo_path: photoPath,
      status: 'open',
      reporter_id: currentStaff?.id ?? null,
      created_at: nowIso(),
      resolved_at: null,
    });
    setTitle('');
    setPhotoPath(null);
  }

  return (
    <Screen>
      <BackButton onClick={() => navigate('/manual')}>ナレッジ</BackButton>
      <SectionLabel>設備・備品を起票</SectionLabel>
      <div className="mb-2 flex gap-2">
        {(['fault', 'restock'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={`min-h-[44px] flex-1 rounded-[11px] border text-[0.84rem] ${kind === option ? 'border-green bg-green/10 text-green' : 'border-line text-ink-light'}`}
          >
            {option === 'fault' ? '不具合' : '補充・発注'}
          </button>
        ))}
      </div>
      <input
        className="mb-2 min-h-[44px] w-full rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base outline-none focus:border-green-light"
        placeholder={kind === 'fault' ? '不具合の内容' : '補充・発注するもの'}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <label className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[11px] border border-line border-dashed text-[0.84rem] text-ink-light">
          <Camera size={16} /> {photoPath ? '写真を添付済み' : '写真を撮る／選ぶ'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onPick}
          />
        </label>
        <button
          type="button"
          aria-label="起票"
          onClick={add}
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[11px] bg-green text-paper"
        >
          <Plus size={18} />
        </button>
      </div>

      <SectionLabel>一覧</SectionLabel>
      {issues.length === 0 ? (
        <EmptyState>起票はありません。</EmptyState>
      ) : (
        issues.map((issue) => (
          <Card key={issue.id}>
            <div className="flex items-center gap-2.5">
              {photoSrc(issue.photo_path) ? (
                <img
                  src={photoSrc(issue.photo_path) ?? ''}
                  alt={issue.title ?? ''}
                  className="h-12 w-12 shrink-0 rounded-[9px] border border-line object-cover"
                />
              ) : null}
              <div className="flex-1">
                <div className="font-bold text-[0.92rem]">{issue.title}</div>
                <div className="text-[0.74rem] text-ink-light">
                  {issue.kind === 'fault' ? '不具合' : '補充・発注'}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateRow('equipment_issue', issue.id, {
                    status: FLOW[issue.status ?? 'open'] ?? 'open',
                    resolved_at: FLOW[issue.status ?? 'open'] === 'resolved' ? nowIso() : null,
                  })
                }
              >
                <Badge tone={issue.status === 'resolved' ? 'ok' : 'warn'}>
                  {LABEL[issue.status ?? 'open']}
                </Badge>
              </button>
            </div>
          </Card>
        ))
      )}
    </Screen>
  );
}
