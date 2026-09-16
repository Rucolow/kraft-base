import { describe, expect, it } from 'vitest';
import { type PgError, type UploadClient, type UploadResult, uploadOp } from './upload';

type Call =
  | { kind: 'insert'; table: string; values: object }
  | { kind: 'update'; table: string; values: object; column?: string; value?: string }
  | { kind: 'delete'; table: string; column?: string; value?: string };

// Fake PostgREST client: records every statement and replays canned results.
function fakeClient(results: { insert?: UploadResult; update?: UploadResult } = {}) {
  const calls: Call[] = [];
  const ok: UploadResult = { error: null };
  const client: UploadClient = {
    from(table: string) {
      return {
        insert(values: object) {
          calls.push({ kind: 'insert', table, values });
          return Promise.resolve(results.insert ?? ok);
        },
        update(values: object) {
          const call: Call = { kind: 'update', table, values };
          calls.push(call);
          return {
            eq(column: string, value: string) {
              call.column = column;
              call.value = value;
              return Promise.resolve(results.update ?? ok);
            },
          };
        },
        delete() {
          const call: Call = { kind: 'delete', table };
          calls.push(call);
          return {
            eq(column: string, value: string) {
              call.column = column;
              call.value = value;
              return Promise.resolve(results.update ?? ok);
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

const err = (code: string): UploadResult => ({ error: { code, message: code } as PgError });

describe('uploadOp', () => {
  it('sends PUT as a plain INSERT (never upsert/update) with the id merged in', async () => {
    const { client, calls } = fakeClient();
    const result = await uploadOp(client, {
      op: 'PUT',
      table: 'shift_unavailable',
      id: 'u1',
      opData: { staff_id: 's1', date: '2026-07-01' },
    });

    expect(result.error).toBeNull();
    expect(calls).toEqual([
      {
        kind: 'insert',
        table: 'shift_unavailable',
        values: { staff_id: 's1', date: '2026-07-01', id: 'u1' },
      },
    ]);
  });

  it('falls back to UPDATE only when the INSERT hits 23505 (row already there)', async () => {
    const { client, calls } = fakeClient({ insert: err('23505'), update: { error: null } });
    const result = await uploadOp(client, {
      op: 'PUT',
      table: 'task',
      id: 't1',
      opData: { title: '薪を割る' },
    });

    expect(result.error).toBeNull();
    expect(calls).toEqual([
      { kind: 'insert', table: 'task', values: { title: '薪を割る', id: 't1' } },
      { kind: 'update', table: 'task', values: { title: '薪を割る' }, column: 'id', value: 't1' },
    ]);
  });

  it('returns the update result from the 23505 fallback', async () => {
    const { client } = fakeClient({ insert: err('23505'), update: err('42501') });
    const result = await uploadOp(client, { op: 'PUT', table: 'task', id: 't1', opData: {} });

    expect(result.error?.code).toBe('42501');
  });

  it('does not fall back on 42501 — an UPDATE would be rejected too', async () => {
    const { client, calls } = fakeClient({ insert: err('42501') });
    const result = await uploadOp(client, {
      op: 'PUT',
      table: 'task',
      id: 't1',
      opData: { title: '薪を割る' },
    });

    expect(result.error?.code).toBe('42501');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.kind).toBe('insert');
  });

  it('sends PATCH as UPDATE ... WHERE id = $1', async () => {
    const { client, calls } = fakeClient();
    const result = await uploadOp(client, {
      op: 'PATCH',
      table: 'task',
      id: 't1',
      opData: { done: 1 },
    });

    expect(result.error).toBeNull();
    // done is a local int boolean; serializeForServer converts it on the way out.
    expect(calls).toEqual([
      { kind: 'update', table: 'task', values: { done: true }, column: 'id', value: 't1' },
    ]);
  });

  it('sends DELETE as DELETE ... WHERE id = $1', async () => {
    const { client, calls } = fakeClient();
    const result = await uploadOp(client, { op: 'DELETE', table: 'task', id: 't1' });

    expect(result.error).toBeNull();
    expect(calls).toEqual([{ kind: 'delete', table: 'task', column: 'id', value: 't1' }]);
  });
});
