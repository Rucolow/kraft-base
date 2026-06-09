import { Bell, BookOpen, Home, ListChecks, ScrollText, Users } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMentions } from '../data/queries';
import { useSession } from '../lib/session';
import { Avatar } from './Avatar';
import { SyncBadge } from './SyncBadge';

const TABS = [
  { to: '/', label: '本日', icon: Home, end: true },
  { to: '/guests', label: 'ゲスト', icon: Users, end: false },
  { to: '/handover', label: '引き継ぎ', icon: ScrollText, end: false },
  { to: '/tasks', label: 'タスク', icon: ListChecks, end: false },
  { to: '/manual', label: 'ナレッジ', icon: BookOpen, end: false },
];

function TopBar() {
  const { currentStaff } = useSession();
  const navigate = useNavigate();
  const { data: mentions } = useMentions(currentStaff?.id ?? null);

  return (
    <header className="flex shrink-0 items-center justify-between gap-2.5 border-line border-b bg-paper/90 px-4 pt-3 pb-2.5 backdrop-blur">
      <button
        type="button"
        onClick={() => navigate('/shift')}
        className="flex min-h-[40px] items-center gap-2 rounded-full border border-line bg-paper py-1 pr-2.5 pl-1"
      >
        <Avatar staff={currentStaff} />
        <span className="font-bold text-[0.8rem] text-ink">{currentStaff?.name ?? '未開始'}</span>
      </button>
      <div className="flex items-center gap-2">
        <SyncBadge />
        <button
          type="button"
          aria-label="あなた宛て"
          onClick={() => navigate('/comms')}
          className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-cream text-green"
        >
          <Bell size={18} />
          {mentions.length > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-orange px-1 font-bold text-[0.6rem] text-paper">
              {mentions.length}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav className="grid shrink-0 grid-cols-5 border-line border-t bg-paper/95 px-1 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-[44px] flex-col items-center gap-1 py-1.5 ${isActive ? 'text-green' : 'text-ink-mute'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.7} />
                <span className="font-bold text-[0.62rem]">{tab.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col bg-paper shadow-kb-lg">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
