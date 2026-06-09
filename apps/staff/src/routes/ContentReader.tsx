import { useNavigate, useParams } from 'react-router-dom';
import { BackButton, EmptyState, NeedsInputBadge, Screen } from '../components/ui';
import { useContentBySlug } from '../data/queries';

export function ContentReader() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { data } = useContentBySlug(slug);
  const item = data[0] ?? null;

  return (
    <Screen>
      <BackButton onClick={() => navigate(-1)}>戻る</BackButton>
      {!item ? (
        <EmptyState>コンテンツが見つかりません。</EmptyState>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-[1.2rem] text-green">{item.title}</h1>
            {item.status === 'needs_input' ? <NeedsInputBadge /> : null}
          </div>
          {item.body ? (
            <p className="mt-3 whitespace-pre-wrap text-[0.92rem] leading-relaxed">{item.body}</p>
          ) : (
            <EmptyState>本文は未入力です。オーナーが運用中に追記します。</EmptyState>
          )}
        </>
      )}
    </Screen>
  );
}
