import { SEED_PRODUCTS } from '../content/products';
import { seedContent, seedTasks } from '../content/seed';
import { jstDate, nowIso } from './date';
import { boolToInt, insertRow, serializeList, uuid } from './db';
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
  const today = jstDate();

  for (const member of Object.values(STAFF)) {
    await insertRow('staff', {
      id: member.id,
      name: member.name,
      role: member.role,
      shift_label: null,
      accent: member.accent,
      auth_user_id: null,
      created_at: at,
    });
  }

  await insertRow('daily_reset', { id: uuid(), last_reset_date: today, created_at: at });

  for (const task of seedTasks) {
    await insertRow('task', {
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
    await insertRow('content', {
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
      bento: 'ヴィーガン弁当 ×1',
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
    await insertRow('guest', {
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

  await insertRow('guest_note', {
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
    await insertRow('timeline_entry', {
      id: uuid(),
      author_id: entry.who,
      kind: 'action',
      body: entry.body,
      ref_type: null,
      ref_id: null,
      created_at: at,
    });
  }

  await insertRow('followup', {
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
    await insertRow('product', {
      id: uuid(),
      name,
      sell_price: sell,
      cost,
      sort: index,
      created_at: at,
    });
  }
}
