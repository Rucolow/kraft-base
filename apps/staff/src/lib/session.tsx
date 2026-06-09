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
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [device, setDeviceState] = useState<DeviceConfig | null>(() => readDeviceConfig());
  const boundary = useMemo(() => shiftBoundaryIso(), []);

  const { data: staff } = useQuery<StaffRow>('SELECT * FROM staff ORDER BY role, name');
  const { data: sessions } = useQuery<ShiftSessionRow>(
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
