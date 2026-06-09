import React, { useState, useEffect, useMemo } from "react";
import {
  Bell, ChevronRight, ChevronLeft, Users, ListChecks, Home, ScrollText,
  BookOpen, Flame, Utensils, Check, ArrowLeftRight, Cloud, Volume2,
  AlertTriangle, Phone, X, Plus, CheckCircle2, Footprints, Languages,
  Sparkles, Send, Pin, Clock
} from "lucide-react";

/* ============================================================
   KRAFT BASE — Staff PWA (MOCKUP)
   モックデータ。バックエンド未接続。React state のみ。
   ============================================================ */

const STAFF = {
  rucolow: { id: "rucolow", name: "ルッコロー", role: "問い合わせ・リモート", hours: "9:00–13:00", initial: "ル", tone: "var(--wood)" },
  day:     { id: "day",     name: "日中スタッフ", role: "清掃・受付",         hours: "13:00–17:00", initial: "日", tone: "var(--green)" },
  morley:  { id: "morley",  name: "モーリー",     role: "夜・配達・火打石",   hours: "17:00–20:00", initial: "モ", tone: "var(--orange)" },
};
const STAFF_LIST = [STAFF.rucolow, STAFF.day, STAFF.morley];

// 「いま何時か」をデモ用に切り替えるための擬似時刻
const SIM = [
  { clock: "13:05", shift: "日中シフト",            who: "day" },
  { clock: "17:10", shift: "夜シフト",              who: "morley" },
  { clock: "19:45", shift: "夜シフト・クローズ前",  who: "morley" },
];

const GUESTS = [
  {
    id: "weber", name: "Lukas & Anna Weber", country: "ドイツ", lang: "de",
    people: 2, checkin: "16:30", bed: "1・2番(下段)", bento: "焼肉弁当 ×2",
    status: "arrived", statusLabel: "到着済",
    notes: ["膝の不調 → 下段にご案内", "明日は小雲取越へ"],
    phrases: [{ label: "見送り(独)", t: "Gute Wanderung!" }, { label: "見送り(英)", t: "Have a great hike!" }],
    thread: [
      { who: "day", t: "下段に荷物棚を寄せておきました。", read: ["morley"] },
    ],
  },
  {
    id: "rossi", name: "Marco Rossi", country: "イタリア", lang: "it",
    people: 1, checkin: "15:00", bed: "3番", bento: "ヴィーガン弁当 ×1",
    status: "arrived", statusLabel: "到着済",
    notes: ["静かに過ごしたいご様子", "縁側を案内済"],
    phrases: [{ label: "見送り(伊)", t: "Buon cammino!" }, { label: "見送り(英)", t: "Have a great hike!" }],
    thread: [],
  },
  {
    id: "schmidt", name: "Jonas Schmidt", country: "ドイツ", lang: "de",
    people: 1, checkin: "遅着 ~19:30", bed: "4番", bento: "なし(カップ麺を案内)",
    status: "late", statusLabel: "遅着 ~19:30",
    notes: ["遅着連絡あり ~19:30", "パスポート写真：OTAメッセージ確認待ち", "名前カード・名簿をベッドに設置済"],
    phrases: [{ label: "見送り(独)", t: "Gute Wanderung!" }],
    thread: [
      { who: "day", t: "Schmidtさんのパスポート、OTAメッセージに届いています。確認お願いします。", read: [] },
    ],
  },
];

const OPEN_ITEMS = [
  { id: "o1", t: "遅着 Schmidt様 ~19:30 / パスポート確認待ち", to: "schmidt" },
  { id: "o2", t: "弁当配達 17:00–18:00（焼肉×2・ヴィーガン×1）", to: null },
];

const TIMELINE = [
  { time: "16:50", who: "day", t: "夜シフト（モーリー）へ引き継ぎ" },
  { time: "16:34", who: "day", t: "チェックイン Weber様（独・2名） 下段にご案内" },
  { time: "15:02", who: "day", t: "チェックイン Rossi様（伊・1名）" },
  { time: "14:20", who: "day", t: "ドミトリー清掃 完了" },
  { time: "13:05", who: "day", t: "出勤・引き継ぎ確認" },
  { time: "11:40", who: "rucolow", t: "本日のゲスト4名を確定（OTA）" },
];

const MENTIONS = [
  { id: "m1", from: "day", t: "Schmidtさんのパスポート、OTAに届いています。確認お願いします。", ctx: "Schmidt様", to: "schmidt" },
  { id: "m2", from: "rucolow", t: "弁当のヴィーガンは緑シール。焼肉と取り違えないように。", ctx: "弁当配達", to: null },
];

const TASKS_INIT = [
  { id: "t1", group: "毎日", t: "ゴミ出し（最後に帰る人）", done: false },
  { id: "t2", group: "毎日", t: "翌朝バナナをセット（宿泊数+2）", done: false },
  { id: "t3", group: "毎日", t: "コーヒー豆の容器を補充", done: true },
  { id: "t4", group: "毎日", t: "和室ちゃぶ台のみかんを補充", done: true },
  { id: "t5", group: "チェックアウトごと", t: "使用済みリネンを洗濯 → 乾燥", done: false },
  { id: "t6", group: "単発", t: "肉のおくだに弁当の受け渡し方法を確認", owner: "rucolow", done: false },
  { id: "t7", group: "単発", t: "シャワー室の排水が悪い → 写真付きで報告", done: false },
];

const MANUAL_SECTIONS = [
  { cat: "基本", items: ["はじめに", "施設・設備・館内ルール", "周辺案内", "接客の基本姿勢"] },
  { cat: "業務", items: ["朝：チェックアウト対応", "日中：清掃・洗濯・準備", "午後：チェックイン業務", "夜：交流と見送り"] },
  { cat: "ゲスト", items: ["外国人ゲスト対応", "ファミリー対応", "ワーケーション対応"] },
  { cat: "対応", items: ["クレーム・緊急時対応", "報告・連絡先"] },
];

/* ---------------- styles ---------------- */
const CSS = `
:root{
  --green:#2D4A3E; --green-light:#3A6355;
  --orange:#C8703C; --orange-light:#D4894F; --orange-deep:#A8542A;
  --wood:#8B6914; --wood-light:#C4A35A; --wood-pale:#E8D5A3;
  --cream:#F5F0E6; --cream-dark:#EDE4D0; --paper:#FDFBF6;
  --ink:#2A2A25; --ink-soft:#6B6555; --ink-mute:#9A9587;
  --line:rgba(42,42,37,0.09);
  --r:16px;
  --s1:0 1px 2px rgba(42,42,37,0.05);
  --s2:0 6px 22px rgba(42,42,37,0.10);
  --s3:0 14px 40px rgba(42,42,37,0.16);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
.kb{
  font-family:'Zen Kaku Gothic New',-apple-system,BlinkMacSystemFont,sans-serif;
  color:var(--ink); line-height:1.6;
  -webkit-text-size-adjust:100%;
  min-height:100dvh; display:grid; place-items:center;
  background:
    radial-gradient(ellipse at 12% 0%, rgba(200,112,60,0.07) 0%, transparent 42%),
    radial-gradient(ellipse at 88% 100%, rgba(45,74,62,0.06) 0%, transparent 42%),
    var(--cream);
  padding:0;
}
.serif{font-family:'Cormorant Garamond','Times New Roman',serif;}
.phone{
  position:relative; width:100%; max-width:430px;
  height:100dvh; max-height:920px;
  background:var(--paper); display:flex; flex-direction:column;
  overflow:hidden; box-shadow:var(--s3);
  overscroll-behavior:contain; touch-action:manipulation;
}
@media (min-width:480px){ .phone{ border-radius:30px; margin:18px 0; height:min(100dvh,880px);} }

/* top bar */
.topbar{
  flex-shrink:0; padding:12px 16px 10px;
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  background:rgba(253,251,246,0.9); backdrop-filter:blur(12px);
  border-bottom:1px solid var(--line);
}
.brand{font-family:'Cormorant Garamond',serif; font-size:1rem; letter-spacing:.22em; color:var(--green);}
.userpill{
  display:flex; align-items:center; gap:8px; padding:5px 10px 5px 5px;
  border:1px solid var(--line); border-radius:999px; background:var(--paper);
  cursor:pointer; min-height:40px;
}
.userpill:active{transform:scale(.97);}
.userpill .nm{font-size:.8rem; font-weight:600; color:var(--ink);}
.avatar{
  width:30px; height:30px; border-radius:50%; flex-shrink:0;
  display:grid; place-items:center; color:#fff; font-weight:700; font-size:.82rem;
}
.tbtns{display:flex; align-items:center; gap:8px;}
.iconbtn{
  position:relative; width:40px; height:40px; border-radius:50%;
  border:1px solid var(--line); background:var(--cream);
  display:grid; place-items:center; color:var(--green); cursor:pointer;
}
.iconbtn:active{transform:scale(.93);}
.dot-badge{
  position:absolute; top:-2px; right:-2px; min-width:17px; height:17px; padding:0 4px;
  border-radius:9px; background:var(--orange); color:#fff; font-size:.6rem; font-weight:700;
  display:grid; place-items:center;
}
.synced{display:flex; align-items:center; gap:5px; font-size:.62rem; color:var(--green-light); letter-spacing:.04em;}
.synced .pip{width:6px; height:6px; border-radius:50%; background:var(--green-light); box-shadow:0 0 0 3px rgba(58,99,85,.16);}

/* scroll area */
.scroll{flex:1; overflow-y:auto; scrollbar-width:none; -webkit-overflow-scrolling:touch;}
.scroll::-webkit-scrollbar{display:none;}
.pad{padding:18px 16px 28px;}

/* now band (cockpit header) */
.nowband{
  margin:0 0 16px; padding:16px 18px; border-radius:var(--r);
  background:linear-gradient(150deg,var(--green) 0%, #25413640 140%), var(--green);
  color:var(--cream); position:relative; overflow:hidden;
}
.nowband:before{content:''; position:absolute; right:-30px; top:-30px; width:120px; height:120px; border-radius:50%; background:rgba(196,163,90,.12);}
.nowclock{
  background:none; border:none; color:var(--cream); cursor:pointer; padding:0;
  display:flex; align-items:baseline; gap:10px; font-family:'Cormorant Garamond',serif;
}
.nowclock .big{font-size:2.5rem; line-height:1; letter-spacing:.02em;}
.nowclock .shift{font-size:.95rem; opacity:.9;}
.nowhint{font-size:.6rem; opacity:.55; letter-spacing:.08em; margin-top:6px;}
.nowwho{display:flex; align-items:center; gap:8px; margin-top:12px; font-size:.8rem; opacity:.95;}

/* section label */
.slabel{
  font-family:'Cormorant Garamond',serif; font-size:.7rem; letter-spacing:.24em; text-transform:uppercase;
  color:var(--ink-mute); margin:22px 2px 9px;
}
.slabel:first-child{margin-top:0;}

/* cards */
.card{
  background:var(--paper); border:1px solid var(--line); border-radius:var(--r);
  padding:14px 16px; margin:0 0 11px; box-shadow:var(--s1);
}
.card.tap{cursor:pointer; transition:transform .12s, box-shadow .2s;}
.card.tap:active{transform:scale(.985);}
.card.primary{border-top:3px solid var(--orange); box-shadow:var(--s2);}
.card-head{display:flex; align-items:center; gap:9px; margin-bottom:8px;}
.card-ic{width:30px; height:30px; border-radius:9px; display:grid; place-items:center; flex-shrink:0;}
.card-title{font-weight:700; font-size:.95rem; color:var(--green);}
.card-meta{margin-left:auto; font-size:.72rem; color:var(--ink-mute);}

/* generic row */
.row{display:flex; align-items:center; gap:10px; padding:11px 0; border-bottom:1px solid var(--line); min-height:44px;}
.row:last-child{border-bottom:none;}
.row .grow{flex:1; min-width:0;}
.row .lab{font-size:.92rem; color:var(--ink);}
.row .sub{font-size:.76rem; color:var(--ink-soft); margin-top:1px;}

/* badges */
.badge{display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:999px; font-size:.7rem; font-weight:700; white-space:nowrap;}
.b-ok{background:rgba(58,99,85,.12); color:var(--green);}
.b-warn{background:rgba(200,112,60,.14); color:var(--orange-deep);}
.b-wood{background:rgba(139,105,20,.12); color:var(--wood);}

/* pinned open items */
.pin{
  display:flex; align-items:flex-start; gap:9px; padding:12px 14px; margin:0 0 9px;
  border-radius:13px; background:rgba(200,112,60,.07); border-left:3px solid var(--orange); cursor:pointer;
}
.pin:active{transform:scale(.99);}
.pin .t{font-size:.86rem; flex:1;}

/* timeline */
.tl{position:relative; margin-left:6px; padding-left:20px;}
.tl:before{content:''; position:absolute; left:4px; top:6px; bottom:6px; width:1.5px; background:var(--line);}
.tl-item{position:relative; padding:0 0 16px;}
.tl-item:last-child{padding-bottom:2px;}
.tl-pt{position:absolute; left:-20px; top:4px; width:9px; height:9px; border-radius:50%; background:var(--paper); border:2px solid var(--wood-light);}
.tl-time{font-family:'Cormorant Garamond',serif; font-size:.78rem; color:var(--wood); font-weight:600;}
.tl-t{font-size:.88rem; margin-top:1px;}
.tl-who{font-size:.72rem; color:var(--ink-mute); margin-top:2px;}

/* checklist */
.chk{display:flex; align-items:center; gap:11px; padding:11px 0; border-bottom:1px dashed var(--line); cursor:pointer; min-height:44px;}
.chk:last-child{border-bottom:none;}
.chk .box{width:21px; height:21px; border-radius:6px; border:1.6px solid var(--green-light); display:grid; place-items:center; flex-shrink:0; transition:.15s;}
.chk.done .box{background:var(--green); border-color:var(--green);}
.chk .ct{font-size:.9rem; flex:1;}
.chk.done .ct{color:var(--ink-mute); text-decoration:line-through;}

/* phrase */
.phrase{display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--line); border-radius:12px; margin:0 0 8px; background:var(--paper);}
.phrase .pt{flex:1;}
.phrase .pl{font-size:.68rem; color:var(--ink-mute); letter-spacing:.06em;}
.phrase .pe{font-size:.98rem; font-weight:500;}
.speak{width:38px; height:38px; border-radius:50%; border:1px solid var(--line); background:var(--cream); color:var(--orange); display:grid; place-items:center; cursor:pointer; flex-shrink:0;}
.speak:active{transform:scale(.9); background:var(--orange); color:#fff;}

/* detail */
.detail-hero{padding:6px 2px 14px; border-bottom:1px solid var(--line); margin-bottom:16px;}
.detail-name{font-size:1.3rem; font-weight:700; color:var(--ink); line-height:1.25;}
.detail-meta{display:flex; gap:14px; flex-wrap:wrap; margin-top:8px; font-size:.78rem; color:var(--ink-soft);}
.kv{display:grid; grid-template-columns:88px 1fr; gap:0; border:1px solid var(--line); border-radius:13px; overflow:hidden; margin:0 0 16px;}
.kv .k{background:var(--cream); color:var(--green); font-weight:600; font-size:.78rem; padding:11px 12px; border-bottom:1px solid var(--line);}
.kv .v{padding:11px 12px; font-size:.88rem; border-bottom:1px solid var(--line);}
.kv .k:last-of-type, .kv .v:last-of-type{border-bottom:none;}

/* thread */
.bubble{background:var(--cream); border-radius:13px; padding:10px 13px; margin:0 0 6px; font-size:.86rem;}
.bubble .bw{font-size:.68rem; color:var(--ink-mute); margin-bottom:3px; font-weight:600;}
.bubble .rr{font-size:.64rem; color:var(--green-light); margin-top:4px;}
.inputbar{display:flex; gap:8px; align-items:center; margin-top:10px;}
.input{
  flex:1; border:1px solid var(--line); border-radius:11px; padding:10px 13px;
  font-size:16px; font-family:inherit; background:var(--cream); color:var(--ink); outline:none;
}
.input:focus{border-color:var(--green-light); box-shadow:0 0 0 3px rgba(58,99,85,.12);}
.sendbtn{width:42px; height:42px; border-radius:11px; border:none; background:var(--green); color:#fff; display:grid; place-items:center; cursor:pointer; flex-shrink:0;}
.sendbtn:active{transform:scale(.93);}

/* mention */
.mention{display:flex; gap:11px; padding:13px; border:1px solid var(--line); border-radius:13px; margin:0 0 10px; background:var(--paper);}
.mention .mt{font-size:.87rem;}
.mention .mctx{font-size:.7rem; color:var(--orange-deep); font-weight:700; margin-top:5px; display:inline-flex; align-items:center; gap:3px;}

/* manual rows */
.mcat{font-family:'Cormorant Garamond',serif; font-size:.7rem; letter-spacing:.2em; text-transform:uppercase; color:var(--wood); margin:18px 2px 6px;}
.mrow{display:flex; align-items:center; gap:8px; padding:11px 12px; border:1px solid var(--line); border-radius:11px; margin-bottom:7px; font-size:.88rem; cursor:pointer; background:var(--paper);}
.mrow:active{background:var(--cream);}

/* tab bar */
.tabbar{
  flex-shrink:0; display:grid; grid-template-columns:repeat(5,1fr);
  background:rgba(253,251,246,0.96); backdrop-filter:blur(14px);
  border-top:1px solid var(--line); padding:7px 4px calc(7px + env(safe-area-inset-bottom));
}
.tab{display:flex; flex-direction:column; align-items:center; gap:3px; padding:7px 2px; background:none; border:none; color:var(--ink-mute); cursor:pointer; min-height:44px;}
.tab:active{transform:scale(.92);}
.tab.active{color:var(--green);}
.tab .tl2{font-size:.62rem; font-weight:700; letter-spacing:.02em;}

/* shift gate */
.gate{flex:1; display:flex; flex-direction:column; padding:34px 24px calc(28px + env(safe-area-inset-bottom)); overflow-y:auto;}
.gate-brand{font-family:'Cormorant Garamond',serif; font-size:1.5rem; letter-spacing:.22em; color:var(--green);}
.gate-tag{font-family:'Cormorant Garamond',serif; font-style:italic; color:var(--orange); font-size:.9rem; margin-top:2px;}
.gate-h{font-size:1.15rem; font-weight:700; margin:30px 0 4px;}
.gate-sub{font-size:.84rem; color:var(--ink-soft); margin-bottom:20px;}
.gcard{display:flex; align-items:center; gap:13px; width:100%; text-align:left; padding:15px; border:1px solid var(--line); border-radius:15px; background:var(--paper); margin-bottom:11px; cursor:pointer; box-shadow:var(--s1); transition:transform .12s,border-color .15s;}
.gcard:active{transform:scale(.985);}
.gcard .gnm{font-weight:700; font-size:1rem;}
.gcard .grole{font-size:.76rem; color:var(--ink-soft); margin-top:1px;}
.gcard .ghours{margin-left:auto; font-family:'Cormorant Garamond',serif; font-size:.82rem; color:var(--wood); font-weight:600;}
.review-from{display:flex; align-items:center; gap:10px; padding:13px 15px; border-radius:14px; background:var(--cream); margin-bottom:16px;}
.btn-primary{width:100%; padding:15px; border:none; border-radius:14px; background:linear-gradient(135deg,var(--green),var(--green-light)); color:var(--cream); font-family:inherit; font-size:.95rem; font-weight:700; letter-spacing:.04em; cursor:pointer; box-shadow:var(--s2); display:flex; align-items:center; justify-content:center; gap:8px; margin-top:8px;}
.btn-primary:active{transform:translateY(1px);}
.btn-ghost{width:100%; padding:13px; border:1px solid var(--line); border-radius:13px; background:transparent; color:var(--ink-soft); font-family:inherit; font-size:.88rem; cursor:pointer; margin-top:10px;}
.lock-note{display:flex; align-items:center; gap:7px; font-size:.74rem; color:var(--ink-mute); margin:16px 2px 4px; justify-content:center;}

/* sheets */
.scrim{position:absolute; inset:0; z-index:50; background:rgba(42,42,37,.46); backdrop-filter:blur(3px); display:flex; align-items:flex-end; animation:fade .2s ease;}
.sheet{width:100%; background:var(--paper); border-radius:24px 24px 0 0; padding:18px 18px calc(22px + env(safe-area-inset-bottom)); max-height:86%; overflow-y:auto; animation:up .28s cubic-bezier(.2,.8,.2,1);}
.grip{width:36px; height:4px; background:var(--line); border-radius:2px; margin:0 auto 14px;}
.sheet-h{font-family:'Cormorant Garamond',serif; font-size:1.1rem; letter-spacing:.06em; color:var(--green); text-align:center; margin-bottom:4px;}
.sheet-sub{text-align:center; font-size:.76rem; color:var(--ink-mute); margin-bottom:16px;}
.closebtn{width:100%; padding:13px; margin-top:8px; background:transparent; border:1px solid var(--line); border-radius:12px; color:var(--ink-soft); font-family:inherit; font-size:.88rem; cursor:pointer;}

.detail-back{display:inline-flex; align-items:center; gap:3px; background:none; border:none; color:var(--green); font-family:inherit; font-size:.86rem; cursor:pointer; padding:2px 0; margin-bottom:6px;}

.rise{animation:rise .42s cubic-bezier(.2,.8,.2,1) both;}
@keyframes rise{from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:translateY(0);}}
@keyframes up{from{transform:translateY(100%);} to{transform:translateY(0);}}
@keyframes fade{from{opacity:0;} to{opacity:1;}}
@media (prefers-reduced-motion:reduce){ .rise,.scrim,.sheet{animation:none;} }
`;

/* ---------------- helpers ---------------- */
const speak = (t, lang = "en-US") => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = lang; u.rate = 0.92;
  window.speechSynthesis.speak(u);
};
const langCode = (t) => /[äöüß]|Wanderung|Willkommen/i.test(t) ? "de-DE" : /cammino|Buon/i.test(t) ? "it-IT" : "en-US";

const Avatar = ({ s, size = 30 }) => (
  <div className="avatar" style={{ background: s.tone, width: size, height: size, fontSize: size * 0.42 }}>{s.initial}</div>
);

const Phrase = ({ label, t }) => {
  const [on, setOn] = useState(false);
  return (
    <div className="phrase">
      <div className="pt">
        <div className="pl">{label}</div>
        <div className="pe">{t}</div>
      </div>
      <button className="speak" aria-label="発音" onClick={() => { setOn(true); speak(t, langCode(t)); setTimeout(() => setOn(false), 1600); }}>
        <Volume2 size={16} />
      </button>
    </div>
  );
};

/* ---------------- screens ---------------- */

function Cockpit({ simIdx, cycle, onOpenGuest, goto, openMentions }) {
  const sim = SIM[simIdx];
  const whoStaff = STAFF[sim.who];

  return (
    <div className="pad">
      <div className="nowband rise">
        <button className="nowclock" onClick={cycle} aria-label="時間帯を切り替え（デモ）">
          <span className="big">{sim.clock}</span>
          <span className="shift">{sim.shift}</span>
        </button>
        <div className="nowwho"><Avatar s={whoStaff} size={24} /> {whoStaff.name} のシフト</div>
        <div className="nowhint">▸ 時刻をタップでシフトを切替（デモ）</div>
      </div>

      {simIdx === 0 && (
        <>
          <div className="card primary rise" style={{ animationDelay: "60ms" }}>
            <div className="card-head">
              <div className="card-ic" style={{ background: "rgba(200,112,60,.12)", color: "var(--orange)" }}><ListChecks size={17} /></div>
              <div className="card-title">受付準備（15:00まで）</div>
              <div className="card-meta">2 / 5</div>
            </div>
            <div className="row"><CheckCircle2 size={17} color="var(--green)" /><span className="lab">ウェルカムドリンク用意</span></div>
            <div className="row"><CheckCircle2 size={17} color="var(--green)" /><span className="lab">共用部 清掃</span></div>
            <div className="row"><Clock size={17} color="var(--ink-mute)" /><span className="lab">ベッドメイク（本日4名分）</span></div>
          </div>
          <div className="card tap rise" style={{ animationDelay: "120ms" }} onClick={() => goto("guests")}>
            <div className="card-head">
              <div className="card-ic" style={{ background: "rgba(45,74,62,.1)", color: "var(--green)" }}><Users size={17} /></div>
              <div className="card-title">本日のチェックイン</div>
              <ChevronRight size={16} color="var(--ink-mute)" style={{ marginLeft: "auto" }} />
            </div>
            <div style={{ fontSize: ".86rem", color: "var(--ink-soft)" }}>4名 — Weber様(2)・Rossi様・Schmidt様（遅着）</div>
          </div>
          <div className="card tap rise" style={{ animationDelay: "180ms" }} onClick={() => goto("handover")}>
            <div className="card-head">
              <div className="card-ic" style={{ background: "rgba(139,105,20,.1)", color: "var(--wood)" }}><ScrollText size={17} /></div>
              <div className="card-title">ルッコローからの引き継ぎ</div>
              <span className="badge b-wood" style={{ marginLeft: "auto" }}>1件</span>
            </div>
            <div style={{ fontSize: ".86rem", color: "var(--ink-soft)" }}>本日のゲスト4名を確定済み（OTA）</div>
          </div>
        </>
      )}

      {simIdx === 1 && (
        <>
          <div className="card primary rise" style={{ animationDelay: "60ms" }}>
            <div className="card-head">
              <div className="card-ic" style={{ background: "rgba(200,112,60,.12)", color: "var(--orange)" }}><Utensils size={17} /></div>
              <div className="card-title">弁当配達 17:00–18:00</div>
              <div className="card-meta">3食</div>
            </div>
            <div className="row"><span className="grow"><div className="lab">焼肉弁当 ×2</div><div className="sub">→ Weber様（1・2番）</div></span></div>
            <div className="row"><span className="grow"><div className="lab">ヴィーガン弁当 ×1 <span className="badge b-ok" style={{ marginLeft: 4 }}>緑シール</span></div><div className="sub">→ Rossi様（3番）</div></span></div>
          </div>
          <div className="card tap rise" style={{ animationDelay: "120ms" }} onClick={() => goto("guests")}>
            <div className="card-head">
              <div className="card-ic" style={{ background: "rgba(45,74,62,.1)", color: "var(--green)" }}><Users size={17} /></div>
              <div className="card-title">到着状況</div>
              <span className="badge b-ok" style={{ marginLeft: "auto" }}>2 / 4</span>
            </div>
            <div style={{ fontSize: ".86rem", color: "var(--ink-soft)" }}>未着：Schmidt様（遅着 ~19:30）</div>
          </div>
          <div className="card tap rise" style={{ animationDelay: "180ms" }} onClick={openMentions}>
            <div className="card-head">
              <div className="card-ic" style={{ background: "rgba(200,112,60,.12)", color: "var(--orange)" }}><Bell size={17} /></div>
              <div className="card-title">あなた宛て</div>
              <span className="badge b-warn" style={{ marginLeft: "auto" }}>2件</span>
            </div>
            <div style={{ fontSize: ".86rem", color: "var(--ink-soft)" }}>日中スタッフ・ルッコローからの確認</div>
          </div>
          <div className="card rise" style={{ animationDelay: "240ms" }}>
            <div className="card-head">
              <div className="card-ic" style={{ background: "rgba(139,105,20,.1)", color: "var(--wood)" }}><Flame size={17} /></div>
              <div className="card-title">就寝前：火打石のお見送り</div>
            </div>
            <div style={{ fontSize: ".86rem", color: "var(--ink-soft)" }}>到着済みのゲストから順に。退勤前までに。</div>
          </div>
        </>
      )}

      {simIdx === 2 && (
        <>
          <div className="card primary rise" style={{ animationDelay: "60ms" }}>
            <div className="card-head">
              <div className="card-ic" style={{ background: "rgba(200,112,60,.12)", color: "var(--orange)" }}><AlertTriangle size={17} /></div>
              <div className="card-title">クローズ前チェック（退勤 20:00目安）</div>
              <div className="card-meta">0 / 4</div>
            </div>
            <div className="row"><Clock size={17} color="var(--ink-mute)" /><span className="lab">火の始末（BBQ・焚き火）</span></div>
            <div className="row"><Clock size={17} color="var(--ink-mute)" /><span className="lab">スタッフルーム施錠</span></div>
            <div className="row"><Clock size={17} color="var(--ink-mute)" /><span className="lab">翌朝セット（バナナ・豆・みかん）</span></div>
            <div className="row"><Clock size={17} color="var(--ink-mute)" /><span className="lab">引き継ぎを投稿</span></div>
          </div>
          <div className="card tap rise" style={{ animationDelay: "120ms" }} onClick={() => onOpenGuest("schmidt")}>
            <div className="card-head">
              <div className="card-ic" style={{ background: "rgba(200,112,60,.12)", color: "var(--orange)" }}><Footprints size={17} /></div>
              <div className="card-title">遅着：Schmidt様</div>
              <span className="badge b-warn" style={{ marginLeft: "auto" }}>~19:30</span>
            </div>
            <div style={{ fontSize: ".86rem", color: "var(--ink-soft)" }}>名前カード・名簿は設置済。玄関は施錠しない。</div>
          </div>
          <div className="card rise" style={{ animationDelay: "180ms" }}>
            <div className="card-head">
              <div className="card-ic" style={{ background: "rgba(139,105,20,.1)", color: "var(--wood)" }}><Flame size={17} /></div>
              <div className="card-title">火打石</div>
              <span className="badge b-wood" style={{ marginLeft: "auto" }}>残り 2名</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GuestList({ onOpen }) {
  return (
    <div className="pad">
      <div className="slabel">Today — 4 guests</div>
      {GUESTS.map((g, i) => (
        <div key={g.id} className="card tap rise" style={{ animationDelay: `${i * 60}ms` }} onClick={() => onOpen(g.id)}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="grow" style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: ".96rem" }}>{g.name}</div>
              <div style={{ fontSize: ".76rem", color: "var(--ink-soft)", marginTop: 2 }}>{g.country}・{g.people}名 ／ IN {g.checkin}・{g.bed}</div>
            </div>
            <span className={`badge ${g.status === "arrived" ? "b-ok" : "b-warn"}`}>{g.statusLabel}</span>
          </div>
        </div>
      ))}
      <div className="card rise" style={{ animationDelay: "200ms", background: "var(--cream)", boxShadow: "none" }}>
        <div style={{ fontSize: ".8rem", color: "var(--ink-soft)" }}>予約は9–13にルッコローがOTAから確定します。連携ではなく確認のうえ反映。</div>
      </div>
    </div>
  );
}

function GuestDetail({ id, back }) {
  const g = GUESTS.find((x) => x.id === id);
  const [thread, setThread] = useState(g.thread);
  const [draft, setDraft] = useState("");
  if (!g) return null;
  return (
    <div className="pad">
      <button className="detail-back" onClick={back}><ChevronLeft size={18} /> 本日のゲスト</button>
      <div className="detail-hero">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div className="detail-name" style={{ flex: 1 }}>{g.name}</div>
          <span className={`badge ${g.status === "arrived" ? "b-ok" : "b-warn"}`}>{g.statusLabel}</span>
        </div>
        <div className="detail-meta">
          <span>{g.country}</span><span>{g.people}名</span><span>IN {g.checkin}</span>
        </div>
      </div>

      <div className="kv">
        <div className="k">ベッド</div><div className="v">{g.bed}</div>
        <div className="k">弁当</div><div className="v">{g.bento}</div>
      </div>

      <div className="slabel">メモ</div>
      <div className="card">
        {g.notes.map((n, i) => (
          <div key={i} className="row"><span className="lab">{n}</span></div>
        ))}
      </div>
      <div className="inputbar">
        <input className="input" placeholder="メモを追加…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="sendbtn" aria-label="追加" onClick={() => setDraft("")}><Plus size={18} /></button>
      </div>

      <div className="slabel" style={{ display: "flex", alignItems: "center", gap: 6 }}><Languages size={13} /> 見送りのことば</div>
      {g.phrases.map((p, i) => <Phrase key={i} label={p.label} t={p.t} />)}
      <div style={{ fontSize: ".72rem", color: "var(--ink-mute)", margin: "2px 2px 6px" }}>マニュアルのフレーズが、このゲストの文脈で出ます。電波ゼロでも開きます。</div>

      <div className="slabel">スレッド</div>
      {thread.length === 0 && <div style={{ fontSize: ".82rem", color: "var(--ink-mute)", padding: "4px 2px 10px" }}>まだやり取りはありません。</div>}
      {thread.map((m, i) => {
        const s = STAFF[m.who];
        return (
          <div key={i} className="bubble">
            <div className="bw">{s.name}</div>
            <div>{m.t}</div>
            {m.read && m.read.length > 0 && <div className="rr">既読 {m.read.map((r) => STAFF[r].name).join("・")}</div>}
          </div>
        );
      })}
      <div className="inputbar">
        <input className="input" placeholder="このゲストについて残す…" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button className="sendbtn" aria-label="送信" onClick={() => { if (!draft.trim()) return; setThread([...thread, { who: "morley", t: draft, read: [] }]); setDraft(""); }}><Send size={17} /></button>
      </div>
    </div>
  );
}

function Handover({ onOpenGuest }) {
  return (
    <div className="pad">
      <div className="slabel" style={{ display: "flex", alignItems: "center", gap: 6 }}><Pin size={12} /> 未完・申し送り</div>
      {OPEN_ITEMS.map((o) => (
        <div key={o.id} className="pin" onClick={() => o.to && onOpenGuest(o.to)}>
          <AlertTriangle size={16} color="var(--orange)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span className="t">{o.t}</span>
          {o.to && <ChevronRight size={15} color="var(--ink-mute)" />}
        </div>
      ))}

      <div className="slabel">タイムライン</div>
      <div style={{ fontSize: ".78rem", color: "var(--ink-soft)", margin: "0 2px 12px" }}>シフト中の記録がそのまま積み上がります。引き継ぎは書類ではなく、この履歴です。</div>
      <div className="tl">
        {TIMELINE.map((e, i) => (
          <div key={i} className="tl-item rise" style={{ animationDelay: `${i * 40}ms` }}>
            <div className="tl-pt" style={{ borderColor: STAFF[e.who].tone }} />
            <div className="tl-time">{e.time}</div>
            <div className="tl-t">{e.t}</div>
            <div className="tl-who">{STAFF[e.who].name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tasks() {
  const [tasks, setTasks] = useState(TASKS_INIT);
  const groups = ["毎日", "チェックアウトごと", "単発"];
  const toggle = (id) => setTasks(tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t));
  return (
    <div className="pad">
      {groups.map((grp) => (
        <div key={grp}>
          <div className="slabel">{grp}</div>
          <div className="card">
            {tasks.filter((t) => t.group === grp).map((t) => (
              <div key={t.id} className={`chk ${t.done ? "done" : ""}`} onClick={() => toggle(t.id)}>
                <div className="box">{t.done && <Check size={14} color="#fff" />}</div>
                <span className="ct">{t.t}</span>
                {t.owner && <span className="badge b-wood">@{STAFF[t.owner].name}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ManualTab() {
  return (
    <div className="pad">
      <div className="card rise" style={{ background: "linear-gradient(140deg,var(--cream-dark),var(--cream))", border: "1px solid var(--wood-pale)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Cloud size={16} color="var(--green)" />
          <span style={{ fontWeight: 700, color: "var(--green)", fontSize: ".92rem" }}>マニュアル（オフライン対応）</span>
        </div>
        <div style={{ fontSize: ".82rem", color: "var(--ink-soft)" }}>既存の12セクションを内包。緊急連絡先・作法・会話集は電波ゼロでも開きます。</div>
      </div>

      <div className="slabel" style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={13} /> 今夜のゲスト向けフレーズ</div>
      <Phrase label="ようこそ（独）" t="Willkommen!" />
      <Phrase label="見送り（独）" t="Gute Wanderung!" />
      <Phrase label="見送り（伊）" t="Buon cammino!" />

      {MANUAL_SECTIONS.map((m) => (
        <div key={m.cat}>
          <div className="mcat">{m.cat}</div>
          {m.items.map((it) => (
            <div key={it} className="mrow"><BookOpen size={14} color="var(--wood)" /> <span style={{ flex: 1 }}>{it}</span><ChevronRight size={14} color="var(--ink-mute)" /></div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------- shift gate (the signature flow) ---------------- */
function ShiftGate({ onStart }) {
  const [staff, setStaff] = useState(null);

  if (!staff) {
    return (
      <div className="gate">
        <div className="gate-brand">KRAFT BASE</div>
        <div className="gate-tag">Unplug to recharge.</div>
        <div className="gate-h">シフトを始めますか？</div>
        <div className="gate-sub">あなたの名前を選んでください。交代は「引き継ぎを受け取る」ことから始まります。</div>
        {STAFF_LIST.map((s) => (
          <button key={s.id} className="gcard" onClick={() => setStaff(s)} style={{ borderColor: "var(--line)" }}>
            <Avatar s={s} size={42} />
            <span>
              <span className="gnm">{s.name}</span>
              <span className="grole">{s.role}</span>
            </span>
            <span className="ghours">{s.hours}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="gate">
      <button className="detail-back" onClick={() => setStaff(null)}><ChevronLeft size={18} /> 戻る</button>
      <div className="gate-h" style={{ marginTop: 8 }}>引き継ぎを確認</div>
      <div className="gate-sub">{staff.name} さん、始める前に前のシフトが残したものを確認してください。</div>

      <div className="review-from">
        <Avatar s={STAFF.day} size={34} />
        <div>
          <div style={{ fontSize: ".82rem", fontWeight: 700 }}>前のシフト：日中スタッフ</div>
          <div style={{ fontSize: ".74rem", color: "var(--ink-soft)" }}>16:50 に申し送り</div>
        </div>
      </div>

      <div className="slabel" style={{ marginTop: 0 }}>未完・申し送り</div>
      {OPEN_ITEMS.map((o) => (
        <div key={o.id} className="pin" style={{ cursor: "default" }}>
          <AlertTriangle size={16} color="var(--orange)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span className="t">{o.t}</span>
        </div>
      ))}

      <div className="card" style={{ marginTop: 6 }}>
        <div className="row"><Bell size={16} color="var(--orange)" /><span className="grow"><span className="lab">あなた宛て 2件</span><div className="sub">日中・ルッコローからの確認</div></span></div>
        <div className="row"><Users size={16} color="var(--green)" /><span className="grow"><span className="lab">到着 2 / 4</span><div className="sub">未着：Schmidt様（遅着 ~19:30）</div></span></div>
        <div className="row"><Utensils size={16} color="var(--wood)" /><span className="grow"><span className="lab">弁当配達 3食</span><div className="sub">17:00–18:00</div></span></div>
      </div>

      <div className="lock-note"><AlertTriangle size={13} /> 確認しないとシフトを始められません</div>
      <button className="btn-primary" onClick={() => onStart(staff)}><Check size={18} /> 確認しました — シフトを開始</button>
    </div>
  );
}

/* ---------------- root ---------------- */
const TABS = [
  { id: "home", label: "本日", icon: Home },
  { id: "guests", label: "ゲスト", icon: Users },
  { id: "handover", label: "引き継ぎ", icon: ScrollText },
  { id: "tasks", label: "タスク", icon: ListChecks },
  { id: "manual", label: "マニュアル", icon: BookOpen },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("home");
  const [guestId, setGuestId] = useState(null);
  const [simIdx, setSimIdx] = useState(1);
  const [sheet, setSheet] = useState(null); // 'mentions' | 'switch'

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap";
    document.head.appendChild(l);
    return () => { try { document.head.removeChild(l); } catch (e) {} };
  }, []);

  const openGuest = (id) => { setGuestId(id); setTab("guests"); };
  const goto = (t) => { setGuestId(null); setTab(t); };
  const cycle = () => setSimIdx((i) => (i + 1) % SIM.length);

  return (
    <div className="kb">
      <style>{CSS}</style>
      <div className="phone">

        {!user && <ShiftGate onStart={(s) => { setUser(s); setTab("home"); setGuestId(null); }} />}

        {user && (
          <>
            <div className="topbar">
              <button className="userpill" onClick={() => setSheet("switch")}>
                <Avatar s={user} />
                <span className="nm">{user.name}</span>
                <ArrowLeftRight size={13} color="var(--ink-mute)" />
              </button>
              <div className="tbtns">
                <div className="synced"><span className="pip" />ローカル保存</div>
                <button className="iconbtn" aria-label="あなた宛て" onClick={() => setSheet("mentions")}>
                  <Bell size={18} />
                  <span className="dot-badge">{MENTIONS.length}</span>
                </button>
              </div>
            </div>

            <div className="scroll" key={tab + (guestId || "")}>
              {tab === "home" && <Cockpit simIdx={simIdx} cycle={cycle} onOpenGuest={openGuest} goto={goto} openMentions={() => setSheet("mentions")} />}
              {tab === "guests" && !guestId && <GuestList onOpen={openGuest} />}
              {tab === "guests" && guestId && <GuestDetail id={guestId} back={() => setGuestId(null)} />}
              {tab === "handover" && <Handover onOpenGuest={openGuest} />}
              {tab === "tasks" && <Tasks />}
              {tab === "manual" && <ManualTab />}
            </div>

            <nav className="tabbar">
              {TABS.map((t) => {
                const Ic = t.icon;
                const active = tab === t.id;
                return (
                  <button key={t.id} className={`tab ${active ? "active" : ""}`} onClick={() => goto(t.id)}>
                    <Ic size={22} strokeWidth={active ? 2.2 : 1.7} />
                    <span className="tl2">{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </>
        )}

        {/* mentions sheet */}
        {sheet === "mentions" && (
          <div className="scrim" onClick={() => setSheet(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="grip" />
              <div className="sheet-h">あなた宛て</div>
              <div className="sheet-sub">@メンションで届いた確認事項</div>
              {MENTIONS.map((m) => (
                <div key={m.id} className="mention" onClick={() => { setSheet(null); m.to && openGuest(m.to); }}>
                  <Avatar s={STAFF[m.from]} size={34} />
                  <div style={{ flex: 1 }}>
                    <div className="mt">{m.t}</div>
                    <div className="mctx"><ChevronRight size={11} />{m.ctx}</div>
                  </div>
                </div>
              ))}
              <button className="closebtn" onClick={() => setSheet(null)}>閉じる</button>
            </div>
          </div>
        )}

        {/* switch sheet — switching = re-handover */}
        {sheet === "switch" && (
          <div className="scrim" onClick={() => setSheet(null)}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div className="grip" />
              <div className="sheet-h">シフトを引き継ぐ</div>
              <div className="sheet-sub">交代すると、次の人は引き継ぎの確認から始まります。</div>
              {STAFF_LIST.map((s) => (
                <button key={s.id} className="gcard" style={{ opacity: s.id === user.id ? 0.45 : 1 }} disabled={s.id === user.id}
                  onClick={() => { setSheet(null); setUser(null); }}>
                  <Avatar s={s} size={40} />
                  <span>
                    <span className="gnm">{s.name}</span>
                    <span className="grole">{s.id === user.id ? "現在のシフト" : s.role}</span>
                  </span>
                  <span className="ghours">{s.hours}</span>
                </button>
              ))}
              <button className="closebtn" onClick={() => setSheet(null)}>閉じる</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
