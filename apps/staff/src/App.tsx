import { useEffect } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './lib/auth';
import { AuthProvider } from './lib/auth';
import { ensureLocalSeed } from './lib/devSeed';
import { PowerSyncProvider } from './lib/powersync/provider';
import { SessionProvider, useSession } from './lib/session';
import { closeStaleSessions, runDailyReset } from './lib/shiftOps';
import { ThemeProvider } from './lib/theme';
import { CheckIn } from './routes/CheckIn';
import { Comms } from './routes/Comms';
import { ContentReader } from './routes/ContentReader';
import { Equipment } from './routes/Equipment';
import { Growlist } from './routes/Growlist';
import { GuestDetail } from './routes/GuestDetail';
import { GuestEdit } from './routes/GuestEdit';
import { Guests } from './routes/Guests';
import { Handover } from './routes/Handover';
import { KnowledgeCategory } from './routes/KnowledgeCategory';
import { LinkAccount } from './routes/LinkAccount';
import { Login } from './routes/Login';
import { LostItems } from './routes/LostItems';
import { ManualHub } from './routes/ManualHub';
import { Products } from './routes/Products';
import { RecordsHub } from './routes/RecordsHub';
import { Setup } from './routes/Setup';
import { ShiftGate } from './routes/ShiftGate';
import { Tasks } from './routes/Tasks';
import { Today } from './routes/Today';
import { WorkTime } from './routes/WorkTime';

function RootBootstrap() {
  const { configured, session } = useAuth();
  const { device, staff } = useSession();
  // Daily reset / stale-session cleanup write to the database. Only attempt them
  // once the signed-in account is actually a linked org member, otherwise RLS
  // rejects the write (403) and PowerSync retries it forever, stalling sync.
  // Local-only mode (no backend) has no uploads, so it is safe there too.
  const canWrite =
    !configured || (!!session && staff.some((member) => member.auth_user_id === session.user.id));
  useEffect(() => {
    ensureLocalSeed().then(() => {
      if (!canWrite) {
        return undefined;
      }
      return runDailyReset().then(() => (device ? closeStaleSessions(device.deviceId) : undefined));
    });
  }, [device, canWrite]);
  return null;
}

function useAutoLock() {
  const { device } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (!device || device.mode !== 'shared' || device.autoLockMin <= 0) {
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => navigate('/shift'), device.autoLockMin * 60_000);
    };
    const events = ['pointerdown', 'keydown'] as const;
    for (const event of events) {
      window.addEventListener(event, reset);
    }
    reset();
    return () => {
      clearTimeout(timer);
      for (const event of events) {
        window.removeEventListener(event, reset);
      }
    };
  }, [device, navigate]);
}

function RequireApp() {
  const { configured, session, loading } = useAuth();
  const { device, staff, activeSession, loading: sessionLoading } = useSession();
  useAutoLock();

  if (configured && loading) {
    return null;
  }
  if (configured && !session) {
    return <Navigate to="/login" replace />;
  }
  // Hold routing decisions until the local staff/session queries have loaded.
  // Redirecting on a still-empty result set bounces fresh page loads away from a
  // session/link that actually exists (the local query resolves a tick later).
  if (sessionLoading) {
    return null;
  }
  if (configured && session && !staff.some((member) => member.auth_user_id === session.user.id)) {
    return <Navigate to="/link" replace />;
  }
  if (!device) {
    return <Navigate to="/setup" replace />;
  }
  if (!activeSession) {
    return <Navigate to="/shift" replace />;
  }
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/link" element={<LinkAccount />} />
      <Route path="/setup" element={<Setup />} />
      <Route path="/shift" element={<ShiftGate />} />
      <Route element={<RequireApp />}>
        <Route path="/checkin/:id" element={<CheckIn />} />
        <Route element={<AppShell />}>
          <Route index element={<Today />} />
          <Route path="guests" element={<Guests />} />
          <Route path="guests/new" element={<GuestEdit />} />
          <Route path="guests/:id" element={<GuestDetail />} />
          <Route path="guests/:id/edit" element={<GuestEdit />} />
          <Route path="handover" element={<Handover />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="manual" element={<ManualHub />} />
          <Route path="manual/k/:kind" element={<KnowledgeCategory />} />
          <Route path="manual/grow" element={<Growlist />} />
          <Route path="manual/products" element={<Products />} />
          <Route path="records" element={<RecordsHub />} />
          <Route path="records/lost" element={<LostItems />} />
          <Route path="records/equipment" element={<Equipment />} />
          <Route path="worktime" element={<WorkTime />} />
          <Route path="manual/c/:slug" element={<ContentReader />} />
          <Route path="comms" element={<Comms />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <PowerSyncProvider>
        <AuthProvider>
          <SessionProvider>
            <BrowserRouter>
              <RootBootstrap />
              <AppRoutes />
            </BrowserRouter>
          </SessionProvider>
        </AuthProvider>
      </PowerSyncProvider>
    </ThemeProvider>
  );
}
