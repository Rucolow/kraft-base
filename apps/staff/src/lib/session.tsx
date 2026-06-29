import { useQuery } from '@powersync/react';
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { shiftBoundaryIso } from './date';
import { type DeviceConfig, readDeviceConfig } from './device';
import type { ShiftSessionRow, StaffRow } from './powersync/schema';

interface SessionValue {
  device: DeviceConfig | null;
  setDevice: (config: DeviceConfig) => void;
  staff: StaffRow[];
  currentStaff: StaffRow | null;
  activeSession: ShiftSessionRow | null;
  isOwner: boolean;
  // True until the staff + shift_session watched queries have produced their first
  // result. The router must not make redirect decisions (to /link or /shift) while
  // this is true, or a fresh page load races the local query and bounces away from
  // a session that actually exists.
  loading: boolean;
  // Current shift-day boundary (04:00 JST). Advances at the boundary even on a
  // long-running device so consumers (RootBootstrap cleanup) can re-run there.
  boundary: string;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [device, setDeviceState] = useState<DeviceConfig | null>(() => readDeviceConfig());
  // The shared reception iPad stays mounted for days, so the shift-day boundary
  // must not be frozen at mount — otherwise sessions never go stale and daily
  // tasks never reset across 04:00. Re-evaluate on a timer and on focus; the
  // value only actually changes (triggering a re-render / query re-bind) when the
  // shift-day rolls.
  const [boundary, setBoundary] = useState(() => shiftBoundaryIso());
  useEffect(() => {
    const tick = () => {
      const next = shiftBoundaryIso();
      setBoundary((prev) => (prev === next ? prev : next));
    };
    const timer = setInterval(tick, 60_000);
    const onWake = () => tick();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
    };
  }, []);

  const { data: staff, isLoading: staffLoading } = useQuery<StaffRow>(
    'SELECT * FROM staff ORDER BY role, name',
  );
  const { data: sessions, isLoading: sessionsLoading } = useQuery<ShiftSessionRow>(
    `SELECT * FROM shift_session
       WHERE device_id = ? AND ended_at IS NULL AND started_at >= ?
       ORDER BY started_at DESC LIMIT 1`,
    [device?.deviceId ?? '', boundary],
  );

  const activeSession = sessions[0] ?? null;
  const currentStaff = useMemo(() => {
    if (!device) {
      return null;
    }
    const id = device.mode === 'personal' ? device.boundStaffId : (activeSession?.staff_id ?? null);
    return staff.find((member) => member.id === id) ?? null;
  }, [device, activeSession, staff]);

  const value: SessionValue = {
    device,
    setDevice: setDeviceState,
    staff,
    currentStaff,
    activeSession,
    isOwner: currentStaff?.role === 'owner',
    loading: staffLoading || sessionsLoading,
    boundary,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return value;
}
