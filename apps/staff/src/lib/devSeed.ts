import { SEED_PRODUCTS } from '../content/products';
import { seedContent, seedTasks } from '../content/seed';
import { nowIso, shiftDate } from './date';
import { type SqlValue, boolToInt, insertRow, serializeList, uuid } from './db';
import { addDays } from './month';
import { db } from './powersync';
import { canConnect } from './powersync/connector';

// Demo staff identities used for the local-only verification path. With Supabase
// configured these rows arrive via sync instead.
const STAFF = {
  owner: {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'ルッコロー',
    role: 'owner',
    accent: '#9a7416',
  },
  morley: {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'モーリー',
    role: 'staff',
    accent: '#e08a2e',
  },
  day: {
    id: '00000000-0000-0000-0000-000000000003',
    name: '日中スタッフ',
    role: 'staff',
    accent: '#0f3d36',
  },
};

export async function ensureLocalSeed(): Promise<void> {
  if (canConnect()) {
    return;
  }
  const existing = await db.get<{ n: number }>('SELECT count(*) AS n FROM staff');
  if (existing.n > 0) {
    return;
  }

  const at = nowIso();
  const today = shiftDate();

  // Seed inside one write transaction. Individual db.execute writes during app
  // bootstrap are not reliably picked up by the React watched queries (the watch
  // read connection doesn't see them until a commit boundary), which left seeded
  // guests/notes invisible in the UI. A single committed transaction fixes that
  // and makes seeding atomic.
  await db.writeTransaction(async (tx) => {
    const ins = (table: string, values: Record<string, SqlValue>) => insertRow(table, values, tx);

    for (const member of Object.values(STAFF)) {
      await ins('staff', {
        id: member.id,
        name: member.name,
        role: member.role,
        shift_label: null,
        accent: member.accent,
        auth_user_id: null,
        created_at: at,
      });
    }

    await ins('daily_reset', { id: uuid(), last_reset_date: today, created_at: at });

    for (const task of seedTasks) {
      await ins('task', {
        id: uuid(),
        title: task.title,
        group: task.group,
        phase: task.phase,
        source: 'manual',
        owner_id: null,
        done: 0,
        done_at: null,
        created_at: at,
      });
    }

    for (const item of seedContent) {
      await ins('content', {
        id: uuid(),
        kind: item.kind,
        slug: item.slug,
        title: item.title,
        body: item.body,
        phase: item.phase,
        lang: item.lang,
        photo_paths: serializeList([]),
        status: item.status,
        updated_by: null,
        updated_at: at,
      });
    }

    const weber = uuid();
    const rossi = uuid();
    const schmidt = uuid();
    const lombardi = uuid();
    const guests = [
      {
        id: weber,
        name: 'Lukas & Anna Weber',
        country: 'ドイツ',
        language: 'de',
        party: 2,
        checkin: '16:30',
        bed: '1・2番（下段）',
        bento: '焼肉弁当 ×2',
        status: 'arrived',
      },
      {
        id: rossi,
        name: 'Marco Rossi',
        country: 'イタリア',
        language: 'it',
        party: 1,
        checkin: '15:00',
        bed: '3番',
        bento: 'ベジタリアン弁当 ×1',
        status: 'arrived',
      },
      {
        id: schmidt,
        name: 'Jonas Schmidt',
        country: 'ドイツ',
        language: 'de',
        party: 1,
        checkin: '遅着 ~19:30',
        bed: '4番',
        bento: 'なし（カップ麺を案内）',
        status: 'late',
      },
    ];
    for (const guest of guests) {
      await ins('guest', {
        id: guest.id,
        stay_date: today,
        name: guest.name,
        country: guest.country,
        language: guest.language,
        party_size: guest.party,
        checkin_time: guest.checkin,
        bed: guest.bed,
        bento: guest.bento,
        status: guest.status,
        review_sent_at: null,
        whole_house: 0,
        created_by: STAFF.owner.id,
        created_at: at,
      });
    }

    // A future stay so the "これから先" tab (R5) shows the per-date bento summary
    // line and a per-guest 🍱 chip in demo mode.
    await ins('guest', {
      id: lombardi,
      stay_date: addDays(today, 2),
      name: 'Sofia Lombardi',
      country: 'イタリア',
      language: 'it',
      party_size: 2,
      checkin_time: '17:00',
      bed: '1・2番（下段）',
      bento: null,
      status: 'expected',
      review_sent_at: null,
      whole_house: 0,
      created_by: STAFF.owner.id,
      created_at: at,
    });

    // koguchi-bento order mirror — one of each display state so the bento panel,
    // matching picker and badges are all exercisable in demo mode.
    const bentoAt = (mins: number) => new Date(Date.parse(at) - mins * 60_000).toISOString();
    const bentoOrders = [
      {
        id: 'bo-paid-1',
        status: 'PAID',
        name: 'Lukas Weber',
        items: [{ slug: 'yakiniku', name: '焼肉弁当', qty: 2 }],
        total: 2400,
        note: null,
        pay: null,
        guest: weber,
        match: 'manual',
      },
      {
        id: 'bo-unmatched-1',
        status: 'PAID',
        name: 'MARCO ROSSI',
        items: [{ slug: 'vegan', name: 'ベジタリアン弁当', qty: 1 }],
        total: 1100,
        note: '減塩でお願いします',
        pay: null,
        guest: null,
        match: 'none',
      },
      {
        id: 'bo-manual-1',
        status: 'CONFIRMED',
        name: '電話 注文',
        items: [{ slug: 'onigiri', name: 'おむすび弁当', qty: 2 }],
        total: 1600,
        note: null,
        pay: 'ONSITE',
        guest: null,
        match: 'none',
      },
      {
        id: 'bo-cancelled-1',
        status: 'CANCELLED',
        name: 'Jonas Schmidt',
        items: [{ slug: 'yakiniku', name: '焼肉弁当', qty: 1 }],
        total: 1200,
        note: null,
        pay: null,
        guest: schmidt,
        match: 'manual',
      },
      {
        id: 'bo-pending-old',
        status: 'PENDING',
        name: null,
        items: [{ slug: 'yakiniku', name: '焼肉弁当', qty: 1 }],
        total: 1200,
        note: null,
        pay: null,
        guest: null,
        match: 'none',
      },
    ];
    for (const [i, o] of bentoOrders.entries()) {
      await ins('bento_order', {
        id: o.id,
        status: o.status,
        channel: 'GUEST',
        delivery_date: today,
        customer_name: o.name,
        items_label: o.items.map((it) => `${it.name} ×${it.qty}`).join('・'),
        items_json: JSON.stringify(o.items.map((it) => ({ ...it, unitPriceYen: 1200 }))),
        total_yen: o.total,
        refunded_yen: 0,
        note: o.note,
        payment_method: o.pay,
        fulfilled_at: null,
        // the stale PENDING must trip the 45-min rule; everything else is fresh
        source_updated_at: o.id === 'bo-pending-old' ? bentoAt(60) : bentoAt(i),
        synced_at: at,
        guest_id: o.guest,
        match: o.match,
      });
    }

    // Future-dated orders for the "これから先" tab (R5): one linked to Sofia (chip),
    // one unmatched on the same day (summary shows 未照合), and one on a day with no
    // staying guest (proves order-only dates still surface).
    const futureBento = [
      {
        id: 'bo-future-linked',
        date: addDays(today, 2),
        name: 'Sofia Lombardi',
        items: [{ slug: 'yakiniku', name: '焼肉弁当', qty: 2 }],
        total: 2400,
        guest: lombardi,
        match: 'manual',
      },
      {
        id: 'bo-future-unmatched',
        date: addDays(today, 2),
        name: 'K. TANAKA',
        items: [{ slug: 'vegan', name: 'ベジタリアン弁当', qty: 1 }],
        total: 1100,
        guest: null,
        match: 'none',
      },
      {
        // Off-date delivery: linked to Sofia (who stays +2) but delivers +3, so the
        // +3 summary must name her even though no one stays +3 (R5 review fix).
        id: 'bo-future-offdate',
        date: addDays(today, 3),
        name: 'Sofia Lombardi',
        items: [{ slug: 'yakiniku', name: '焼肉弁当', qty: 1 }],
        total: 1200,
        guest: lombardi,
        match: 'manual',
      },
      {
        id: 'bo-future-orphan',
        date: addDays(today, 4),
        name: '電話 注文',
        items: [{ slug: 'onigiri', name: 'おむすび弁当', qty: 2 }],
        total: 1600,
        guest: null,
        match: 'none',
      },
    ];
    for (const o of futureBento) {
      await ins('bento_order', {
        id: o.id,
        status: 'PAID',
        channel: 'GUEST',
        delivery_date: o.date,
        customer_name: o.name,
        items_label: o.items.map((it) => `${it.name} ×${it.qty}`).join('・'),
        items_json: JSON.stringify(o.items.map((it) => ({ ...it, unitPriceYen: 1200 }))),
        total_yen: o.total,
        refunded_yen: 0,
        note: null,
        payment_method: null,
        fulfilled_at: null,
        source_updated_at: bentoAt(0),
        synced_at: at,
        guest_id: o.guest,
        match: o.match,
      });
    }

    // Rota (shift plan) — a few assignments around today, plus last week's so the
    // "copy last week" action has a source in the demo.
    for (const plan of [
      { date: today, staff: STAFF.morley.id, label: null },
      { date: today, staff: STAFF.day.id, label: '遅番' },
      { date: addDays(today, 1), staff: STAFF.morley.id, label: null },
      { date: addDays(today, 3), staff: STAFF.day.id, label: null },
      { date: addDays(today, -7), staff: STAFF.morley.id, label: null },
      { date: addDays(today, -6), staff: STAFF.day.id, label: '遅番' },
    ]) {
      await ins('shift_plan', {
        id: uuid(),
        date: plan.date,
        staff_id: plan.staff,
        label: plan.label,
        created_by: STAFF.owner.id,
        created_at: at,
      });
    }

    await ins('guest_note', {
      id: uuid(),
      guest_id: schmidt,
      author_id: STAFF.day.id,
      body: 'Schmidtさんのパスポート、OTAメッセージに届いています。確認お願いします。',
      pinned: boolToInt(false),
      mentions: serializeList([STAFF.morley.id]),
      read_by: serializeList([]),
      created_at: at,
    });

    for (const entry of [
      { body: '本日のゲスト3名を確定（OTA）', who: STAFF.owner.id },
      { body: 'チェックイン Rossi様（伊・1名）', who: STAFF.day.id },
      { body: 'チェックイン Weber様（独・2名） 下段にご案内', who: STAFF.day.id },
    ]) {
      await ins('timeline_entry', {
        id: uuid(),
        author_id: entry.who,
        kind: 'action',
        body: entry.body,
        ref_type: null,
        ref_id: null,
        created_at: at,
      });
    }

    await ins('followup', {
      id: uuid(),
      body: '遅着 Schmidt様 ~19:30 / パスポート確認待ち',
      guest_id: schmidt,
      status: 'open',
      requires_owner: boolToInt(false),
      created_by: STAFF.day.id,
      created_at: at,
      resolved_at: null,
    });

    for (const [index, [name, sell, cost]] of SEED_PRODUCTS.entries()) {
      await ins('product', {
        id: uuid(),
        name,
        sell_price: sell,
        cost,
        sort: index,
        created_at: at,
      });
    }
  });
}
