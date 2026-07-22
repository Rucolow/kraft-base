// Single source for the operational content seed (spec §7.0/§11), derived from
// the staff manual and the area/safety addendum. Known facts ship as `ready`;
// site-specific unknowns ship as `needs_input` so they surface in the grow list.
// This module also backs supabase/seed_content.sql via scripts/gen-content-seed.

export type ContentStatus = 'ready' | 'needs_input';
export type TaskGroup = 'daily' | 'per_checkout' | 'oneoff';
export type Phase = 'midday_prep' | 'cleaning' | 'evening_close' | 'morning_prep';

export interface SeedTask {
  title: string;
  group: TaskGroup;
  phase: Phase | null;
}

export interface SeedContent {
  kind: 'manual' | 'location' | 'procedure' | 'area' | 'emergency' | 'price' | 'phrase';
  slug: string;
  title: string;
  body: string;
  phase: Phase | null;
  lang: string | null;
  status: ContentStatus;
}

// Manual-derived checklists surfaced on the cockpit by phase (spec §7.0).
export const seedTasks: SeedTask[] = [
  { title: 'ウェルカムドリンク（梅ジュース・みかん）を用意', group: 'daily', phase: 'midday_prep' },
  { title: '共用部を清掃', group: 'daily', phase: 'midday_prep' },
  { title: 'ベッドメイク（本日の宿泊数分）', group: 'daily', phase: 'midday_prep' },
  { title: 'アメニティを補充', group: 'daily', phase: 'midday_prep' },
  { title: 'コーヒー豆の容器を補充', group: 'daily', phase: 'midday_prep' },
  { title: '和室ちゃぶ台のみかんを補充', group: 'daily', phase: 'midday_prep' },
  { title: 'ドミトリーを清掃', group: 'daily', phase: 'cleaning' },
  { title: 'シャワー・トイレを清掃', group: 'daily', phase: 'cleaning' },
  { title: '使用済みリネンを洗濯 → 乾燥', group: 'per_checkout', phase: 'cleaning' },
  { title: '火の始末（BBQ・焚き火）', group: 'daily', phase: 'evening_close' },
  { title: 'スタッフルームを施錠', group: 'daily', phase: 'evening_close' },
  {
    title: '玄関の戸締りを確認（遅着がいる日は施錠しない）',
    group: 'daily',
    phase: 'evening_close',
  },
  { title: '引き継ぎを投稿', group: 'daily', phase: 'evening_close' },
  { title: '翌朝バナナをセット（宿泊数 +2）', group: 'daily', phase: 'morning_prep' },
  { title: '翌朝のコーヒーを準備', group: 'daily', phase: 'morning_prep' },
  { title: 'ゴミ出し（最後に帰る人）', group: 'daily', phase: 'morning_prep' },
];

const manual: Array<[string, string, string]> = [
  [
    'manual-welcome',
    'はじめに',
    'KRAFT BASE は熊野古道・小口のゲストハウス。「Unplug to recharge.」歩く人が静かに整う場所として迎える。',
  ],
  [
    'manual-facility',
    '施設・設備・館内ルール',
    'ドミトリー、和室、共用キッチン、無料の洗濯機・乾燥機、Wi-Fi、屋外喫煙所。21:00以降は静かに。',
  ],
  [
    'manual-mindset',
    '接客の基本姿勢',
    '勝手に足さない。まず運営に提案。引き算で、取りこぼさず、押し付けない。',
  ],
  [
    'manual-checkout',
    '朝：チェックアウト対応',
    'コーヒーとバナナを案内。翌朝のバスを前夜に伝える。お礼/レビュー依頼は予約サイト経由（対面では依頼しない）。',
  ],
  [
    'manual-midday',
    '日中：清掃・洗濯・準備',
    '清掃・洗濯・ベッドメイク・補充。受付準備を15:00までに整える。',
  ],
  [
    'manual-afternoon',
    '午後：チェックイン業務',
    '名前確認、パスポート確認（法定）、ベッド案内、館内案内。ウェルカムドリンクを出す。',
  ],
  [
    'manual-evening',
    '夜：交流と見送り',
    '弁当配達、火打石のお見送り、翌朝の案内。到着済みのゲストから順に。',
  ],
  [
    'manual-foreign',
    '外国人ゲスト対応',
    '英語の基本セットで対応。込み入った会話は受付iPadの翻訳アプリ。',
  ],
  ['manual-family', 'ファミリー対応', '夏の川遊びは安全な浅瀬を案内。増水時は中止を促す。'],
  [
    'manual-workation',
    'ワーケーション対応',
    'オフシーズンの長期滞在。Wi-Fi と静かな作業環境を案内。',
  ],
];

const procedures: Array<[string, string, string, Phase | null, ContentStatus]> = [
  [
    'proc-checkin',
    'チェックイン手順',
    '名前確認 → パスポート確認（法定）→ 用紙記入 → ベッド案内 → 館内案内 → ウェルカムドリンク。',
    'midday_prep',
    'ready',
  ],
  [
    'proc-welcome-drink',
    'ウェルカムドリンクの一言',
    '「梅ジュースとみかんをどうぞ。地元のものです。」到着のねぎらいとともに出す。',
    'midday_prep',
    'ready',
  ],
  [
    'proc-shower',
    'シャワー案内',
    'シャワー・トイレの場所と使い方、タオルの位置を案内する。',
    null,
    'ready',
  ],
  [
    'proc-kamidana',
    '神棚の作法',
    '二礼・二拍手・一礼。翌朝、希望者がご自分の手で安全祈願をできる。',
    null,
    'ready',
  ],
  [
    'proc-hiuchi',
    '火打石（切り火）の進行',
    '出かける人の背後で火打石と火打金を打ち合わせ火花を散らし、安全を願う。固有の石・道具・保管場所・声かけ・辞退時対応はモーリーと実演して確定。',
    'evening_close',
    'needs_input',
  ],
  [
    'proc-payment',
    '決済の使い方（Square / PayPay）',
    '館内販売の決済手順。具体操作は要確認。',
    null,
    'needs_input',
  ],
  [
    'proc-bento',
    '弁当の受け取り・見分け',
    '肉のおくだの弁当。ベジタリアンは緑シール。受け取り方法・見分けは要確認。',
    null,
    'needs_input',
  ],
  [
    'proc-bbq',
    'BBQ の運用',
    '火気の扱い、片付け、火の始末。固有の運用は要確認。',
    null,
    'needs_input',
  ],
  [
    'proc-claim',
    'クレーム対応',
    'まず傾聴し謝意を示す。その場で判断せず運営に確認・連絡。',
    null,
    'ready',
  ],
  [
    'proc-emergency',
    '緊急時手順',
    '緊急は電話。警察110／消防・救急119。重症は119。運営（肉のおくだ）080-8032-9762。',
    null,
    'ready',
  ],
];

const area: Array<[string, string, string, ContentStatus]> = [
  [
    'area-trails',
    '熊野古道（小雲取越・大雲取越）',
    '小雲取越：小口→請川/本宮 約13km・約4時間30分。大雲取越：那智大社→小口 約14.5km・中辺路最難関。古道上に売店・自販機なし。昼食・水は出発前に用意。',
    'ready',
  ],
  [
    'area-bus',
    '交通（バス）',
    'JR新宮駅 ⇄ 小口は神丸（または志古）で乗り換え。便数は少ない。最新の時刻表は要確認、受付に紙を常備。',
    'needs_input',
  ],
  [
    'area-taxi',
    'タクシー',
    '新宮市内のタクシー手配（距離が長く高額）。事業者名・概算料金は要確認。',
    'needs_input',
  ],
  [
    'area-shop',
    '買い物・売店',
    '小口にコンビニ・スーパーなし。最寄りは新宮方面で約1時間。直近店舗と距離は要確認。',
    'needs_input',
  ],
  [
    'area-river',
    '川遊び（夏）',
    '赤木川・小口川は清流。安全な浅瀬・更衣/トイレの場所は現地確認。増水時は中止。',
    'needs_input',
  ],
];

const emergency: Array<[string, string, string, ContentStatus]> = [
  [
    'emergency-contacts',
    '緊急連絡先',
    '警察 110 ／ 消防・救急 119 ／ 運営（肉のおくだ）080-8032-9762。緊急は電話。',
    'ready',
  ],
  [
    'emergency-hospital',
    '医療機関',
    '救急・入院は新宮市立医療センター 0735-31-3333。日中の軽症は熊野川診療所（住所・電話・診療時間は要確認）。',
    'needs_input',
  ],
  [
    'emergency-disaster',
    '想定災害',
    '主リスクは熊野川・赤木川の河川氾濫と土砂災害。大雨・台風時は警報を待たず早めの自主避難を。',
    'ready',
  ],
  [
    'emergency-shelter',
    '避難場所',
    '小口自然の家（熊野川町上長井398、0735-45-2434）が現実的な拠点。小和瀬・小口地区の正式な指定避難場所は要確認。',
    'needs_input',
  ],
  [
    'emergency-aed',
    'AED',
    '最寄りのAED設置場所は要確認（小口自然の家・公民館等）。',
    'needs_input',
  ],
  [
    'emergency-roster',
    '法定名簿の保管',
    '宿泊者名簿の保管場所は未定。保管場所・保存期間・施錠を決めて追記する。',
    'needs_input',
  ],
];

const prices: Array<[string, string, string, ContentStatus]> = [
  ['price-list', '館内販売の価格', '飲み物・軽食・物販の価格表。要確認。', 'needs_input'],
];

const locationItems: Array<[string, string]> = [
  ['location-linen', 'リネン棚'],
  ['location-cleaning', '清掃用具'],
  ['location-amenities', 'アメニティ補充'],
  ['location-welcome-drink', 'ウェルカムドリンク'],
  ['location-coffee', 'コーヒー / 朝食在庫'],
  ['location-firstaid', '救急箱'],
  ['location-extinguisher', '消火器'],
  ['location-router', 'Wi-Fi ルーター'],
  ['location-locker', 'ロッカー'],
  ['location-roster', '名簿用紙'],
  ['location-guide', '施設案内'],
  ['location-trash', 'ゴミ集積 / 収集'],
];

const phraseItems: Array<[string, string, string]> = [
  ['ようこそ、KRAFT BASE へ。', 'Welcome to KRAFT BASE.', 'en'],
  ['少々お待ちください。', 'One moment, please.', 'en'],
  ['お名前を教えてください。', 'May I have your name, please?', 'en'],
  [
    'パスポートを見せていただけますか？（法律上の義務です）',
    'May I see your passport? It is a legal requirement for foreign guests.',
    'en',
  ],
  [
    '下の段と上の段、どちらがお好みですか？',
    'Would you prefer the lower bunk or the upper one?',
    'en',
  ],
  ['シャワーとトイレはこちらです。', 'The showers and toilets are this way.', 'en'],
  ['洗濯機と乾燥機は無料でお使いいただけます。', 'The washer and dryer are free to use.', 'en'],
  ['21:00以降はお静かにお願いします。', 'Please keep the noise down after 9 PM.', 'en'],
  ['コーヒーとバナナはご自由にどうぞ。', 'Please help yourself to coffee and bananas.', 'en'],
  ['良い旅を！', 'Have a great hike!', 'en'],
  ['翻訳アプリを使いますね。', 'Let me use a translation app.', 'en'],
  ['ようこそ（独）', 'Willkommen!', 'de'],
  ['見送り（独）', 'Gute Wanderung!', 'de'],
  ['見送り（伊）', 'Buon cammino!', 'it'],
];

export const seedContent: SeedContent[] = [
  ...manual.map(
    ([slug, title, body]): SeedContent => ({
      kind: 'manual',
      slug,
      title,
      body,
      phase: null,
      lang: null,
      status: 'ready',
    }),
  ),
  ...procedures.map(
    ([slug, title, body, phase, status]): SeedContent => ({
      kind: 'procedure',
      slug,
      title,
      body,
      phase: phase as Phase | null,
      lang: null,
      status: status as ContentStatus,
    }),
  ),
  ...area.map(
    ([slug, title, body, status]): SeedContent => ({
      kind: 'area',
      slug,
      title,
      body,
      phase: null,
      lang: null,
      status: status as ContentStatus,
    }),
  ),
  ...emergency.map(
    ([slug, title, body, status]): SeedContent => ({
      kind: 'emergency',
      slug,
      title,
      body,
      phase: null,
      lang: null,
      status: status as ContentStatus,
    }),
  ),
  ...prices.map(
    ([slug, title, body, status]): SeedContent => ({
      kind: 'price',
      slug,
      title,
      body,
      phase: null,
      lang: null,
      status: status as ContentStatus,
    }),
  ),
  ...locationItems.map(
    ([slug, title]): SeedContent => ({
      kind: 'location',
      slug,
      title,
      body: '',
      phase: null,
      lang: null,
      status: 'needs_input',
    }),
  ),
  ...phraseItems.map(
    ([title, body, lang]): SeedContent => ({
      kind: 'phrase',
      slug: `phrase-${lang}-${title.slice(0, 8)}`,
      title,
      body,
      phase: null,
      lang,
      status: 'ready',
    }),
  ),
];
