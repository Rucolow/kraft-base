import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { EmptyState, Screen, SectionLabel } from '../components/ui';
import { useAuth } from '../lib/auth';
import { updateRow } from '../lib/db';
import { useSession } from '../lib/session';

export function LinkAccount() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { staff } = useSession();
  const unlinked = staff.filter((member) => !member.auth_user_id);

  async function link(staffId: string) {
    if (!session) {
      return;
    }
    await updateRow('staff', staffId, { auth_user_id: session.user.id });
    navigate('/');
  }

  return (
    <Screen>
      <SectionLabel>アカウントの紐づけ</SectionLabel>
      <p className="mb-3 px-1 text-[0.84rem] text-ink-light">
        ログインしたあなたのアカウントを、スタッフに紐づけてください。
      </p>
      {unlinked.length === 0 ? (
        <EmptyState>紐づけ可能なスタッフがいません。</EmptyState>
      ) : (
        unlinked.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => link(member.id)}
            className="mb-2 flex w-full items-center gap-3 rounded-[14px] border border-line bg-paper p-3 text-left"
          >
            <Avatar staff={member} size={36} />
            <span className="flex-1 font-bold text-[0.92rem]">{member.name}</span>
            <span className="text-[0.76rem] text-ink-light">
              {member.role === 'owner' ? 'オーナー' : 'スタッフ'}
            </span>
          </button>
        ))
      )}
    </Screen>
  );
}
