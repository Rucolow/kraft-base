import { describe, expect, it } from 'vitest';
import { bedNumbers, joinBeds, parseBeds, toggleBed, usedBedChips } from './beds';

describe('bed parsing (R8)', () => {
  it('reads chip-built and legacy free-text bed strings', () => {
    expect(bedNumbers('1番・2番')).toEqual([1, 2]);
    expect(bedNumbers('1・2番（下段）')).toEqual([1, 2]);
    expect(bedNumbers('3番')).toEqual([3]);
    expect(bedNumbers('下段')).toEqual([]);
    expect(bedNumbers(null)).toEqual([]);
  });

  it('collects used bed chips in house order, skipping cancelled bookings', () => {
    const chips = usedBedChips([
      { bed: '5番', status: 'late' },
      { bed: '1・2番（下段）', status: 'arrived' },
      { bed: '6番', status: 'cancelled' }, // never occupied
      { bed: null, status: 'arrived' },
    ]);
    expect(chips).toEqual(['1番', '2番', '5番']);
  });

  it('matches 和室 literally (no digits to parse)', () => {
    expect(usedBedChips([{ bed: '和室', status: 'arrived' }])).toEqual(['和室']);
    // The parenthetical 2名 must not read as bed 2番.
    expect(usedBedChips([{ bed: '和室（2名）', status: 'arrived' }])).toEqual(['和室']);
  });

  it('is empty when nobody stayed', () => {
    expect(usedBedChips([])).toEqual([]);
  });
});

describe('parseBeds / joinBeds / toggleBed (detail-screen chips)', () => {
  it('round-trips chip strings and null', () => {
    expect(parseBeds('1番・2番')).toEqual(['1番', '2番']);
    expect(parseBeds(null)).toEqual([]);
    expect(joinBeds([])).toBeNull();
    expect(joinBeds(['3番'])).toBe('3番');
  });
  it('toggles in house order and keeps legacy tokens', () => {
    expect(toggleBed(['2番'], '1番')).toEqual(['1番', '2番']);
    expect(toggleBed(['1番', '2番'], '1番')).toEqual(['2番']);
    expect(toggleBed(['1・2番（下段）'], '和室')).toEqual(['和室', '1・2番（下段）']);
    expect(joinBeds(toggleBed(parseBeds('和室・1・2番（下段）'), '和室'))).toBe('1・2番（下段）');
  });
});
