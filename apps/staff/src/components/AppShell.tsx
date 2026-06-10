import {
  Bell,
  BookOpen,
  Boxes,
  Home,
  ListChecks,
  Moon,
  ScrollText,
  Sun,
  Users,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMentions } from '../data/queries';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/theme';
import { Avatar } from './Avatar';
import { SyncBadge } from './SyncBadge';

const TABS = [
  { to: '/', label: '本日', icon: Home, end: true },
  { to: '/guests', label: 'ゲスト', icon: Users, end: false },
  { to: '/handover', label: '引き継ぎ', icon: ScrollText, end: false },
  { to: '/tasks', label: 'タスク', icon: ListChecks, end: false },
  { to: '/manual', label: '辞書', icon: BookOpen, end: false },
  { to: '/records', label: '台帳', icon: Boxes, end: false },
];

function TopBar() {
  const { currentStaff } = useSession();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { data: mentions } = useMentions(currentStaff?.id ?? null);

  return (
    <header className="flex shrink-0 items-center justify-between gap-2.5 border-line border-b bg-paper/90 px-4 pt-3 pb-2.5 backdrop-blur md:px-8">
      <button
        type="button"
        onClick={() => navigate('/shift')}
        className="flex min-h-[48px] items-center gap-2 rounded-full border border-line bg-paper py-1 pr-3.5 pl-1"
      >
        <Avatar staff={currentStaff} size={36} />
        <span className="font-bold text-[0.92rem] text-ink">{currentStaff?.name ?? '未開始'}</span>
      </button>
      <div className="flex items-center gap-2">
        <SyncBadge />
        <button
          type="button"
          aria-label={theme === 'dark' ? 'ライトモードに切替' : 'ダークモードに切替'}
          onClick={toggle}
          className="grid h-12 w-12 place-items-center rounded-full border border-line bg-cream text-orange"
        >
          {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
        </button>
        <button
          type="button"
          aria-label="あなた宛て"
          onClick={() => navigate('/comms')}
          className="relative grid h-12 w-12 place-items-center rounded-full border border-line bg-cream text-orange"
        >
          <Bell size={22} />
          {mentions.length > 0 ? (
            <span className="-top-0.5 -right-0.5 absolute grid h-[19px] min-w-[19px] place-items-center rounded-full bg-orange px-1 font-bold text-[0.66rem] text-ondark">
              {mentions.length}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
}

function SideNav() {
  return (
    <nav className="hidden shrink-0 border-line border-r bg-paper/95 px-3 pt-7 pb-4 md:flex md:w-60 md:flex-col md:gap-1.5">
      <div className="mb-7 px-3 font-heading text-[1.15rem] tracking-[0.22em] text-orange">
        KRAFT BASE
      </div>
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-[54px] items-center gap-3 rounded-[12px] px-3.5 font-bold text-[1.02rem] ${
                isActive ? 'bg-orange/15 text-orange' : 'text-ink-light'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.7} />
                {tab.label}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function BottomNav() {
  return (
    <nav className="grid shrink-0 grid-cols-6 border-line border-t bg-paper/95 px-1 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-col items-center gap-1 py-2 ${isActive ? 'text-orange' : 'text-ink-mute'}`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={25} strokeWidth={isActive ? 2.2 : 1.7} />
                <span className="font-bold text-[0.66rem]">{tab.label}</span>
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
    <div className="kb-grain flex h-dvh bg-paper">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[520px] md:max-w-4xl xl:max-w-6xl">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
