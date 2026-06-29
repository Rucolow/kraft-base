import { useStatus } from '@powersync/react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { Badge, GhostButton, Screen, SectionLabel } from '../components/ui';
import { useAuth } from '../lib/auth';
import { updateRow } from '../lib/db';
import { useSession } from '../lib/session';

export function LinkAccount() {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const { staff } = useSession();
  const status = useStatus();

  const myId = session?.user.id;
  const alreadyLinked = Boolean(myId) && staff.some((member) => member.auth_user_id === myId);

  // A linked account (including the shared device account) should never sit on
  // this screen — send it on so the app guard can route to setup/shift/home.
  useEffect(() => {
    if (alreadyLinked) {
      navigate('/', { replace: true });
    }
  }, [alreadyLinked, navigate]);

  // Once an owner is already linked, an unclaimed owner row must not be claimable
  // by anyone else — that would escalate a regular sign-in to owner rights. The
  // first owner can still self-claim during bootstrap (nobody linked yet).
  const ownerLinked = staff.some((member) => member.role === 'owner' && member.auth_user_id);

  async function link(staffId: string) {
    if (!session) {
      return;
    }
    const target = staff.find((member) => member.id === staffId);
    if (target?.role === 'owner' && ownerLinked && target.auth_user_id !== myId) {
      return;
    }
    await updateRow('staff', staffId, { auth_user_id: session.user.id });
    navigate('/');
  }

  const people = staff.filter((member) => !member.is_device);
  const connectionNote = !status.connected
    ? 'サーバーに接続中です…'
    : !status.hasSynced
      ? 'スタッフ情報を同期しています…'
      : null;

  return (
    <Screen>
      <SectionLabel>アカウントの紐づけ</SectionLabel>
      <p className="mb-2 px-1 text-[0.86rem] text-ink-light">
        ログイン中のアカウントを、自分のスタッフ名に紐づけてください。
      </p>
      {session ? (
        <p className="mb-4 px-1 text-[0.78rem] text-ink-mute">
          ログイン中：<span className="text-ink">{session.user.email}</span>
        </p>
      ) : null}

      {people.length === 0 ? (
        <div className="rounded-kb border border-line bg-paper p-4">
          <div className="flex items-center gap-2 font-bold text-[0.95rem] text-ink">
            <span className="h-2.5 w-2.5 rounded-full bg-orange" />
            {connectionNote ?? 'スタッフがまだ登録されていません'}
          </div>
          <p className="mt-2 text-[0.8rem] text-ink-light">
            {connectionNote
              ? '数秒待っても変わらない場合は、再読み込みしてください。'
              : 'オーナーがスタッフを登録すると、ここに表示されます。'}
          </p>
          <div className="mt-3">
            <GhostButton onClick={() => window.location.reload()}>再読み込み</GhostButton>
          </div>
        </div>
      ) : (
        people.map((member) => {
          const linkedToMe = member.auth_user_id === myId;
          const linkedToOther = Boolean(member.auth_user_id) && !linkedToMe;
          const blockedOwner = member.role === 'owner' && ownerLinked && !linkedToMe;
          return (
            <button
              key={member.id}
              type="button"
              disabled={linkedToOther || blockedOwner}
              onClick={() => (linkedToMe ? navigate('/') : link(member.id))}
              className="mb-2 flex w-full items-center gap-3 rounded-[14px] border border-line bg-paper p-3.5 text-left disabled:opacity-45"
            >
              <Avatar staff={member} size={40} />
              <span className="flex-1 font-bold text-[0.96rem]">{member.name}</span>
              {linkedToMe ? (
                <Badge tone="ok">あなた</Badge>
              ) : linkedToOther ? (
                <Badge tone="neutral">登録済み</Badge>
              ) : (
                <span className="text-[0.78rem] text-ink-light">
                  {member.role === 'owner' ? 'オーナー' : 'スタッフ'}
                </span>
              )}
            </button>
          );
        })
      )}

      <div className="mt-6">
        <GhostButton
          onClick={() => {
            signOut().then(() => navigate('/login'));
          }}
        >
          別のメールでログインし直す
        </GhostButton>
      </div>
    </Screen>
  );
}
