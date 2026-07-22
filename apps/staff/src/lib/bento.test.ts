import { describe, expect, it } from 'vitest';
import {
  hasPartialRefund,
  isPresumedExpired,
  isUnmatched,
  isVisibleOrder,
  mealsBySlug,
  parseItems,
  paymentLabel,
  totalMeals,
} from './bento';
import type { BentoOrderRow } from './powersync/schema';

const base = (over: Partial<BentoOrderRow>): BentoOrderRow =>
  ({
    id: 'o1',
    status: 'PAID',
    channel: 'GUEST',
    delivery_date: '2026-07-25',
    customer_name: 'テスト 太郎',
    items_label: '焼肉弁当 ×2',
    items_json: '[{"slug":"yakiniku","name":"焼肉弁当","qty":2,"unitPriceYen":1000}]',
    total_yen: 2000,
    refunded_yen: 0,
    note: null,
    payment_method: null,
    fulfilled_at: null,
    source_updated_at: new Date().toISOString(),
    synced_at: null,
    guest_id: null,
    match: 'none',
    ...over,
  }) as BentoOrderRow;

describe('parseItems', () => {
  it('parses slug/name/qty and drops zero-qty rows', () => {
    const items = parseItems(
      '[{"slug":"yakiniku","name":"焼肉弁当","qty":2},{"slug":"onigiri","name":"おむすび弁当","qty":0}]',
    );
    expect(items).toEqual([{ slug: 'yakiniku', name: '焼肉弁当', qty: 2 }]);
  });
  it('is safe on null / broken JSON / non-arrays', () => {
    expect(parseItems(null)).toEqual([]);
    expect(parseItems('not json')).toEqual([]);
    expect(parseItems('{"a":1}')).toEqual([]);
  });
});

describe('visibility rules (§5)', () => {
  it('shows PAID / CONFIRMED / INVOICED', () => {
    for (const status of ['PAID', 'CONFIRMED', 'INVOICED']) {
      expect(isVisibleOrder(base({ status }))).toBe(true);
    }
  });
  it('hides EXPIRED and unknown statuses', () => {
    expect(isVisibleOrder(base({ status: 'EXPIRED' }))).toBe(false);
    expect(isVisibleOrder(base({ status: 'SOMETHING_NEW' }))).toBe(false);
  });
  it('shows cancelled/refunded only when linked to a guest', () => {
    expect(isVisibleOrder(base({ status: 'CANCELLED' }))).toBe(false);
    expect(isVisibleOrder(base({ status: 'CANCELLED', guest_id: 'g1' }))).toBe(true);
    expect(isVisibleOrder(base({ status: 'REFUNDED', guest_id: 'g1' }))).toBe(true);
  });
  it('shows fresh PENDING, hides stale PENDING (45-min rule)', () => {
    const fresh = base({ status: 'PENDING' });
    expect(isVisibleOrder(fresh)).toBe(true);
    const stale = base({
      status: 'PENDING',
      source_updated_at: new Date(Date.now() - 46 * 60_000).toISOString(),
    });
    expect(isPresumedExpired(stale)).toBe(true);
    expect(isVisibleOrder(stale)).toBe(false);
  });
});

describe('isUnmatched (§4)', () => {
  it('flags active, unlinked, non-excluded GUEST orders', () => {
    expect(isUnmatched(base({}))).toBe(true);
  });
  it('ignores linked, excluded, INN, pending and cancelled orders', () => {
    expect(isUnmatched(base({ guest_id: 'g1', match: 'manual' }))).toBe(false);
    expect(isUnmatched(base({ match: 'excluded' }))).toBe(false);
    expect(isUnmatched(base({ channel: 'INN' }))).toBe(false);
    expect(isUnmatched(base({ status: 'PENDING' }))).toBe(false);
    expect(isUnmatched(base({ status: 'CANCELLED' }))).toBe(false);
  });
  it('resurfaces when the linked guest was deleted (guest_id nulled, match kept)', () => {
    expect(isUnmatched(base({ guest_id: null, match: 'manual' }))).toBe(true);
  });
});

describe('meal totals (slug aggregation)', () => {
  const orders = [
    base({ id: 'a' }),
    base({
      id: 'b',
      status: 'CONFIRMED',
      items_json:
        '[{"slug":"yakiniku","name":"焼肉弁当","qty":1},{"slug":"vegan","name":"ベジタリアン弁当","qty":1}]',
    }),
    base({ id: 'c', status: 'CANCELLED', guest_id: 'g1' }), // cancelled: not counted
    base({ id: 'd', status: 'PENDING' }), // pending: not counted
    base({
      id: 'e',
      status: 'PAID',
      items_json: '[{"slug":"mystery","name":"夏野菜弁当","qty":3}]',
    }),
  ];
  it('sums active orders only, including unknown slugs', () => {
    expect(totalMeals(orders)).toBe(2 + 2 + 3);
    const by = mealsBySlug(orders);
    expect(by.find((e) => e.slug === 'yakiniku')?.qty).toBe(3);
    expect(by.find((e) => e.slug === 'vegan')?.qty).toBe(1);
    expect(by.find((e) => e.slug === 'mystery')?.qty).toBe(3); // unknown still counted
  });
});

describe('labels', () => {
  it('maps payment tags, passes through unknowns, nulls on empty', () => {
    expect(paymentLabel('ONSITE')).toBe('現地決済');
    expect(paymentLabel('NEWTAG')).toBe('NEWTAG');
    expect(paymentLabel(null)).toBeNull();
  });
  it('partial refund badge only for PAID with refunded_yen > 0', () => {
    expect(hasPartialRefund(base({ refunded_yen: 500 }))).toBe(true);
    expect(hasPartialRefund(base({ refunded_yen: 0 }))).toBe(false);
    expect(hasPartialRefund(base({ status: 'CONFIRMED', refunded_yen: 500 }))).toBe(false);
  });
});
