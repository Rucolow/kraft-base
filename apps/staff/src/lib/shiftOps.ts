import { nowIso, shiftBoundaryIso, shiftDate } from './date';
import { boolToInt, insertRow, updateRow, uuid } from './db';
import { db } from './powersync';
import type { ShiftSessionRow, TaskRow } from './powersync/schema';
import { dailyNeedsReset } from './shift';

// Active session for a device: open and started after today's 04:00 JST boundary.
export async function getActiveSession(deviceId: string): Promise<ShiftSessionRow | null> {
  return db.getOptional<ShiftSessionRow>(
    `SELECT * FROM shift_session
       WHERE device_id = ? AND ended_at IS NULL AND started_at >= ?
       ORDER BY started_at DESC LIMIT 1`,
    [deviceId, shiftBoundaryIso()],
  );
}

export async function getPreviousEndedSession(deviceId: string): Promise<ShiftSessionRow | null> {
  return db.getOptional<ShiftSessionRow>(
    `SELECT * FROM shift_session
       WHERE device_id = ? AND ended_at IS NOT NULL
       ORDER BY ended_at DESC LIMIT 1`,
    [deviceId],
  );
}

// Closes the current device session, if any. Account switch == re-handover.
export async function endActiveSession(deviceId: string): Promise<void> {
  const active = await getActiveSession(deviceId);
  if (active) {
    await updateRow('shift_session', active.id, { ended_at: nowIso() });
  }
}

// Starts a shift; replaces any open session on the same device first (spec §4.4).
export async function startShift(input: {
  staffId: string;
  deviceId: string;
}): Promise<string> {
  await endActiveSession(input.deviceId);
  const id = uuid();
  const at = nowIso();
  await insertRow('shift_session', {
    id,
    staff_id: input.staffId,
    device_id: input.deviceId,
    started_at: at,
    ended_at: null,
    handover_reviewed_at: at,
    created_at: at,
  });
  await insertRow('timeline_entry', {
    id: uuid(),
    author_id: input.staffId,
    kind: 'system',
    body: '出勤・引き継ぎ確認',
    ref_type: null,
    ref_id: null,
    created_at: at,
  });
  return id;
}

// Closes any session left open past today's boundary (client-side guard, spec §4.4).
export async function closeStaleSessions(deviceId: string): Promise<void> {
  await db.execute(
    `UPDATE shift_session SET ended_at = ?
       WHERE device_id = ? AND ended_at IS NULL AND started_at < ?`,
    [nowIso(), deviceId, shiftBoundaryIso()],
  );
}

// Resets daily tasks once per JST day (spec §5).
export async function runDailyReset(): Promise<void> {
  const today = shiftDate();
  const reset = await db.getOptional<{ id: string; last_reset_date: string }>(
    'SELECT id, last_reset_date FROM daily_reset ORDER BY last_reset_date DESC LIMIT 1',
  );
  if (!dailyNeedsReset(reset?.last_reset_date ?? null, today)) {
    return;
  }
  await db.execute(
    'UPDATE task SET done = 0, done_at = NULL WHERE "group" = \'daily\' AND done = 1',
  );
  if (reset) {
    await updateRow('daily_reset', reset.id, { last_reset_date: today });
  } else {
    await insertRow('daily_reset', {
      id: uuid(),
      last_reset_date: today,
      created_at: nowIso(),
    });
  }
}

export async function setTaskDone(task: Pick<TaskRow, 'id'>, done: boolean): Promise<void> {
  await updateRow('task', task.id, {
    done: boolToInt(done),
    done_at: done ? nowIso() : null,
  });
}
