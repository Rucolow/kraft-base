import { Schema, Table, column } from '@powersync/web';

// Local-first mirror of the Supabase schema (spec.md §6). PowerSync supplies an
// implicit text `id` column per table. Booleans and ints map to integer; uuids,
// timestamps and arrays (json) map to text.

const staff = new Table({
  name: column.text,
  role: column.text,
  shift_label: column.text,
  accent: column.text,
  auth_user_id: column.text,
  is_device: column.integer,
  created_at: column.text,
});

const device = new Table({
  mode: column.text,
  bound_staff_id: column.text,
  label: column.text,
  auto_lock_min: column.integer,
  created_at: column.text,
});

const shift_session = new Table(
  {
    staff_id: column.text,
    device_id: column.text,
    started_at: column.text,
    ended_at: column.text,
    handover_reviewed_at: column.text,
    created_at: column.text,
  },
  { indexes: { open: ['ended_at'] } },
);

const guest = new Table(
  {
    stay_date: column.text,
    name: column.text,
    country: column.text,
    language: column.text,
    party_size: column.integer,
    checkin_time: column.text,
    bed: column.text,
    bento: column.text,
    status: column.text,
    review_sent_at: column.text,
    whole_house: column.integer,
    created_by: column.text,
    created_at: column.text,
  },
  { indexes: { stay: ['stay_date'] } },
);

const guest_note = new Table(
  {
    guest_id: column.text,
    author_id: column.text,
    body: column.text,
    pinned: column.integer,
    mentions: column.text,
    read_by: column.text,
    created_at: column.text,
  },
  { indexes: { guest: ['guest_id'] } },
);

const timeline_entry = new Table(
  {
    author_id: column.text,
    kind: column.text,
    body: column.text,
    ref_type: column.text,
    ref_id: column.text,
    created_at: column.text,
  },
  { indexes: { recent: ['created_at'] } },
);

const followup = new Table({
  body: column.text,
  guest_id: column.text,
  status: column.text,
  requires_owner: column.integer,
  created_by: column.text,
  created_at: column.text,
  resolved_at: column.text,
});

const task = new Table({
  title: column.text,
  group: column.text,
  phase: column.text,
  source: column.text,
  owner_id: column.text,
  done: column.integer,
  done_at: column.text,
  created_at: column.text,
});

const content = new Table(
  {
    kind: column.text,
    slug: column.text,
    title: column.text,
    body: column.text,
    phase: column.text,
    lang: column.text,
    photo_paths: column.text,
    status: column.text,
    updated_by: column.text,
    updated_at: column.text,
  },
  { indexes: { kind: ['kind'] } },
);

const lost_item = new Table({
  item: column.text,
  found_date: column.text,
  place: column.text,
  finder_id: column.text,
  guest_id: column.text,
  photo_path: column.text,
  status: column.text,
  note: column.text,
  created_at: column.text,
});

const equipment_issue = new Table({
  kind: column.text,
  title: column.text,
  photo_path: column.text,
  status: column.text,
  reporter_id: column.text,
  created_at: column.text,
  resolved_at: column.text,
});

const daily_reset = new Table({
  last_reset_date: column.text,
  created_at: column.text,
});

const checkin_record = new Table(
  {
    guest_id: column.text,
    name: column.text,
    address: column.text,
    contact: column.text,
    nationality: column.text,
    passport_number: column.text,
    created_at: column.text,
  },
  { indexes: { guest: ['guest_id'] } },
);

const product = new Table({
  name: column.text,
  sell_price: column.integer,
  cost: column.integer,
  sort: column.integer,
  created_at: column.text,
});

const shift_plan = new Table(
  {
    date: column.text,
    staff_id: column.text,
    label: column.text,
    created_by: column.text,
    created_at: column.text,
  },
  { indexes: { date: ['date'] } },
);

// Mirror of koguchi-bento orders (written server-side by the bento_writer role;
// the app only reads and links guest_id/match).
const bento_order = new Table(
  {
    status: column.text,
    channel: column.text,
    delivery_date: column.text,
    customer_name: column.text,
    items_label: column.text,
    items_json: column.text,
    total_yen: column.integer,
    refunded_yen: column.integer,
    note: column.text,
    payment_method: column.text,
    fulfilled_at: column.text,
    source_updated_at: column.text,
    synced_at: column.text,
    guest_id: column.text,
    match: column.text,
  },
  { indexes: { date: ['delivery_date'], guest: ['guest_id'] } },
);

export const AppSchema = new Schema({
  staff,
  device,
  shift_session,
  guest,
  guest_note,
  timeline_entry,
  followup,
  task,
  content,
  lost_item,
  equipment_issue,
  daily_reset,
  checkin_record,
  product,
  shift_plan,
  bento_order,
});

export type Database = (typeof AppSchema)['types'];
export type StaffRow = Database['staff'];
export type DeviceRow = Database['device'];
export type ShiftSessionRow = Database['shift_session'];
export type GuestRow = Database['guest'];
export type GuestNoteRow = Database['guest_note'];
export type TimelineEntryRow = Database['timeline_entry'];
export type FollowupRow = Database['followup'];
export type TaskRow = Database['task'];
export type ContentRow = Database['content'];
export type LostItemRow = Database['lost_item'];
export type EquipmentIssueRow = Database['equipment_issue'];
export type DailyResetRow = Database['daily_reset'];
export type CheckinRecordRow = Database['checkin_record'];
export type ProductRow = Database['product'];
export type ShiftPlanRow = Database['shift_plan'];
export type BentoOrderRow = Database['bento_order'];
