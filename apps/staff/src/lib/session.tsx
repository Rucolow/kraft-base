import { useQuery } from '@powersync/react';
import { type ReactNode, createContext, useContext, useMemo, useState } from 'react';
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
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [device, setDeviceState] = useState<DeviceConfig | null>(() => readDeviceConfig());
  const boundary = useMemo(() => shiftBoundaryIso(), []);

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
