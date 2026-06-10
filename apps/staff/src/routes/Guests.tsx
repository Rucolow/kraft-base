import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, EmptyState, Screen, SectionLabel } from '../components/ui';
import { useTodaysGuests } from '../data/queries';
import { useSession } from '../lib/session';

export function Guests() {
  const navigate = useNavigate();
  const { isOwner } = useSession();
  const { data: guests } = useTodaysGuests();

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <SectionLabel>
          本日のゲスト — <span className="font-sans tabular-nums">{guests.length}</span>名
        </SectionLabel>
        {isOwner ? (
          <button
            type="button"
            onClick={() => navigate('/guests/new')}
            className="flex items-center gap-1 rounded-full bg-orange px-3 py-1.5 font-bold text-[0.74rem] text-green-deep"
          >
            <Plus size={14} /> 追加
          </button>
        ) : null}
      </div>

      {guests.length === 0 ? (
        <EmptyState>本日のゲストは未登録です。予約は9–13にオーナーがOTAから確定します。</EmptyState>
      ) : (
        <div className="md:grid md:grid-cols-2 md:items-start md:gap-x-3 xl:grid-cols-3">
          {guests.map((guest) => (
            <Card key={guest.id} onClick={() => navigate(`/guests/${guest.id}`)}>
              <div className="flex items-center gap-2.5">
                <div className="flex-1">
                  <div className="font-bold text-[0.96rem]">{guest.name}</div>
                  <div className="mt-0.5 text-[0.76rem] text-ink-light">
                    {guest.country}・{guest.party_size}名 ／ IN {guest.checkin_time}・{guest.bed}
                  </div>
                </div>
                <Badge tone={guest.status === 'arrived' ? 'ok' : 'warn'}>
                  {guest.status === 'arrived'
                    ? '到着済'
                    : guest.status === 'late'
                      ? '遅着'
                      : '予定'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Screen>
  );
}
