import { nowIso } from './date';
import { insertRow, uuid } from './db';
import { db } from './powersync';

export type DeviceMode = 'shared' | 'personal';

export interface DeviceConfig {
  deviceId: string;
  mode: DeviceMode;
  label: string;
  boundStaffId: string | null;
  autoLockMin: number;
}

const STORAGE_KEY = 'kb.device';

export function readDeviceConfig(): DeviceConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as DeviceConfig;
  } catch {
    return null;
  }
}

export function writeDeviceConfig(config: DeviceConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// Registers the device once: persists the local config and mirrors a `device` row.
export async function registerDevice(input: {
  mode: DeviceMode;
  label: string;
  boundStaffId: string | null;
  autoLockMin: number;
}): Promise<DeviceConfig> {
  const config: DeviceConfig = { deviceId: uuid(), ...input };
  await insertRow('device', {
    id: config.deviceId,
    mode: config.mode,
    bound_staff_id: config.boundStaffId,
    label: config.label,
    auto_lock_min: config.autoLockMin,
    created_at: nowIso(),
  });
  writeDeviceConfig(config);
  return config;
}

export async function deviceRowExists(deviceId: string): Promise<boolean> {
  const row = await db.getOptional<{ id: string }>('SELECT id FROM device WHERE id = ?', [
    deviceId,
  ]);
  return row !== null;
}
