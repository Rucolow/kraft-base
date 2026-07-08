import { beforeEach, describe, expect, it } from 'vitest';
import { clearSyncAlerts, getSyncAlerts, recordSyncAlert, subscribeSyncAlerts } from './syncAlerts';

const sample = (table: string) => ({ table, op: 'PUT', code: '42501', message: 'denied' });

beforeEach(() => {
  clearSyncAlerts();
  localStorage.clear();
});

describe('syncAlerts', () => {
  it('records newest first', () => {
    recordSyncAlert(sample('device'));
    recordSyncAlert(sample('shift_session'));
    const list = getSyncAlerts();
    expect(list).toHaveLength(2);
    expect(list[0]?.table).toBe('shift_session');
    expect(list[1]?.table).toBe('device');
    expect(list[0]?.at).toBeTruthy();
  });

  it('caps at 20 as a ring buffer, dropping the oldest', () => {
    for (let i = 0; i < 25; i++) {
      recordSyncAlert(sample(`t${i}`));
    }
    const list = getSyncAlerts();
    expect(list).toHaveLength(20);
    expect(list[0]?.table).toBe('t24');
    expect(list[19]?.table).toBe('t5');
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    let count = 0;
    const unsub = subscribeSyncAlerts(() => {
      count++;
    });
    recordSyncAlert(sample('a'));
    expect(count).toBe(1);
    unsub();
    recordSyncAlert(sample('b'));
    expect(count).toBe(1);
  });

  it('clear empties the store and notifies', () => {
    let count = 0;
    subscribeSyncAlerts(() => {
      count++;
    });
    recordSyncAlert(sample('a'));
    clearSyncAlerts();
    expect(getSyncAlerts()).toHaveLength(0);
    expect(count).toBe(2);
  });

  it('persists to localStorage', () => {
    recordSyncAlert(sample('device'));
    const raw = localStorage.getItem('kb.syncAlerts');
    expect(raw).toContain('device');
  });
});
