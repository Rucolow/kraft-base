import { describe, expect, it } from 'vitest';
import { ARRAY_COLUMNS, BOOLEAN_COLUMNS, serializeForServer } from './serialize';

describe('serializeForServer', () => {
  it('converts local int booleans to real booleans', () => {
    expect(serializeForServer('guest', { whole_house: 1 })).toEqual({ whole_house: true });
    expect(serializeForServer('guest', { whole_house: 0 })).toEqual({ whole_house: false });
    expect(serializeForServer('task', { done: 1 })).toEqual({ done: true });
    expect(serializeForServer('guest_note', { pinned: 0 })).toEqual({ pinned: false });
    expect(serializeForServer('followup', { requires_owner: 1 })).toEqual({ requires_owner: true });
    expect(serializeForServer('staff', { is_device: 1 })).toEqual({ is_device: true });
  });

  it('accepts string/boolean truthy forms', () => {
    expect(serializeForServer('task', { done: '1' })).toEqual({ done: true });
    expect(serializeForServer('task', { done: true })).toEqual({ done: true });
    expect(serializeForServer('task', { done: '0' })).toEqual({ done: false });
  });

  it('converts JSON-text arrays to real arrays', () => {
    expect(serializeForServer('guest_note', { mentions: '["a","b"]' })).toEqual({
      mentions: ['a', 'b'],
    });
    expect(serializeForServer('guest_note', { read_by: '[]' })).toEqual({ read_by: [] });
    expect(serializeForServer('content', { photo_paths: '["p1","p2"]' })).toEqual({
      photo_paths: ['p1', 'p2'],
    });
  });

  it('passes already-array values through and bad JSON to []', () => {
    expect(serializeForServer('guest_note', { mentions: ['x'] })).toEqual({ mentions: ['x'] });
    expect(serializeForServer('guest_note', { mentions: 'not json' })).toEqual({ mentions: [] });
  });

  it('leaves nulls untouched (so PATCH/clearing still works)', () => {
    expect(serializeForServer('guest', { whole_house: null })).toEqual({ whole_house: null });
    expect(serializeForServer('guest_note', { mentions: null })).toEqual({ mentions: null });
  });

  it('only touches mapped columns and preserves the rest', () => {
    expect(
      serializeForServer('guest', { id: 'g1', name: 'Weber', party_size: 2, whole_house: 1 }),
    ).toEqual({ id: 'g1', name: 'Weber', party_size: 2, whole_house: true });
  });

  it('leaves unknown tables/columns unchanged', () => {
    expect(serializeForServer('unknown', { whole_house: 1 })).toEqual({ whole_house: 1 });
    expect(serializeForServer('guest', { other: 1 })).toEqual({ other: 1 });
  });

  it('pins the documented column set (update when migrations add bool/array columns)', () => {
    expect(BOOLEAN_COLUMNS).toEqual({
      guest: ['whole_house'],
      guest_note: ['pinned'],
      task: ['done'],
      followup: ['requires_owner'],
      staff: ['is_device'],
    });
    expect(ARRAY_COLUMNS).toEqual({
      guest_note: ['mentions', 'read_by'],
      content: ['photo_paths'],
    });
  });
});
