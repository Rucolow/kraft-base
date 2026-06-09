import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, X, Phone, AlertTriangle, BookOpen, Sunrise, Sun, Moon,
  Users, Heart, MapPin, Building, Languages, Coffee,
  Sparkles, Volume2, ChevronRight, Bell, ListChecks, Wifi
} from "lucide-react";

/* ============================================================
   KRAFT BASE — Staff Manual (Mobile/Tablet)
   Single-file React artifact. Designed for touch.
   ============================================================ */

// === DATA ===
const CATEGORIES = [
  { id: "foundation", ja: "基本", en: "Foundation", icon: BookOpen },
  { id: "flow",       ja: "業務", en: "Daily Flow", icon: Sun },
  { id: "care",       ja: "ゲスト", en: "Guest Care", icon: Users },
  { id: "urgent",     ja: "対応", en: "Urgent", icon: AlertTriangle }
];

const SECTIONS = [
  { id: "welcome",   num: "01", category: "foundation", title: "はじめに", sub: "Welcome",        icon: Sparkles },
  { id: "facility",  num: "02", category: "foundation", title: "施設・設備・館内ルール", sub: "Facility",     icon: Building },
  { id: "area",      num: "03", category: "foundation", title: "周辺案内", sub: "Area",          icon: MapPin },
  { id: "mindset",   num: "04", category: "foundation", title: "接客の基本姿勢", sub: "Mindset",   icon: Heart },
  { id: "morning",   num: "05", category: "flow",       title: "朝:チェックアウト対応", sub: "Morning",   icon: Sunrise },
  { id: "midday",    num: "06", category: "flow",       title: "日中:清掃・洗濯・準備", sub: "Midday",    icon: Sun },
  { id: "afternoon", num: "07", category: "flow",       title: "午後:チェックイン業務", sub: "Afternoon", icon: Coffee },
  { id: "evening",   num: "08", category: "flow",       title: "夜:交流と見送り", sub: "Evening",   icon: Moon },
  { id: "foreign",   num: "09", category: "care",       title: "外国人ゲスト対応", sub: "Foreign",   icon: Languages },
  { id: "family",    num: "10", category: "care",       title: "ファミリー対応", sub: "Family",    icon: Users },
  { id: "workation", num: "11", category: "care",       title: "ワーケーション対応", sub: "Workation", icon: Wifi },
  { id: "emergency", num: "12", category: "urgent",     title: "クレーム・緊急時対応", sub: "Emergency", icon: AlertTriangle },
  { id: "report",    num: "13", category: "urgent",     title: "報告・連絡先", sub: "Report",    icon: Bell }
];

const EMERGENCY_NUMBERS = [
  { label: "警察",           sub: "Police",            tel: "110",          display: "110",          accent: "var(--green)" },
  { label: "消防・救急",       sub: "Fire / Ambulance",  tel: "119",          display: "119",          accent: "var(--orange)" },
  { label: "肉のおくだ",        sub: "運営",                tel: "08080329762",  display: "080-8032-9762", accent: "var(--wood)" }
];

// 要確認・未確定の項目。確定したらこの配列から削除し、本文に反映する。
const PENDING_ITEMS = [
  {
    id: "staff-app",
    topic: "スタッフアプリの制作",
    detail: "引き継ぎ・本日のゲスト・設備備品・忘れ物・連絡・タスク管理を1つにまとめた専用アプリ。受付の iPad で管理。Discord の代替。",
    askTo: "制作タスク",
    sectionId: "report"
  },
  {
    id: "hiuchi-details",
    topic: "火打石の作法詳細",
    detail: "石・道具と保管場所、構え方・打ち方、声かけスクリプト(日英)、失敗時・辞退時の対応、就寝時間がバラつくときの実施タイミング。モーリーと実演して確定。",
    askTo: "運用検討(モーリー)",
    sectionId: "evening"
  },
  {
    id: "guide-content",
    topic: "ゲスト配布物(施設案内)の内容整備",
    detail: "緊急連絡先(肉のおくだ 080-8032-9762)、神棚の作法、季節の果物の説明、時間外対応ポリシーを日英で記載。",
    askTo: "制作タスク",
    sectionId: "afternoon"
  },
  {
    id: "staff-script",
    topic: "日中スタッフ向け英語台本と翻訳アプリ手順",
    detail: "英語に不慣れなスタッフ用に、よく使う場面の台本と iPad の翻訳アプリの使い方を用意。",
    askTo: "制作タスク",
    sectionId: "foreign"
  },
  {
    id: "review-message",
    topic: "お礼・レビュー依頼メッセージの定型文",
    detail: "チェックアウト当日にルッコローが予約サイト経由で送るお礼メッセージ(日英)。感謝+さりげないレビュー依頼。",
    askTo: "制作タスク",
    sectionId: "morning"
  },
  {
    id: "area-data",
    topic: "熊野古道・交通データの収集と時刻表リスト化",
    detail: "古道入口までの徒歩時間、小雲取越・大雲取越の所要時間、最寄りバス停と路線、バス時刻表、タクシー、コンビニ・スーパーまでの距離。収集後 §03 クイックリファレンスに反映。",
    askTo: "調査タスク",
    sectionId: "area"
  }
];

// English phrases used for search and reference in §09
const PHRASES = [
  { group: "挨拶・基本",        ja: "ようこそ、KRAFT BASE へ。",                   en: "Welcome to KRAFT BASE." },
  { group: "挨拶・基本",        ja: "少々お待ちください。",                       en: "One moment, please." },
  { group: "挨拶・基本",        ja: "確認しますね。",                             en: "Let me check for you." },
  { group: "休憩・歓迎",        ja: "早いお着きですね。ごゆっくりお待ちください。",       en: "You're here early! Please make yourself comfortable while you wait." },
  { group: "休憩・歓迎",        ja: "どうぞ、こちらの和室でお座りください。",            en: "Please have a seat here in the tatami room." },
  { group: "休憩・歓迎",        ja: "梅ジュースとみかんをどうぞ。地元のものです。",         en: "Please enjoy some plum juice and mikan oranges — they're local." },
  { group: "休憩・歓迎",        ja: "明日はどちらまで歩かれますか?",                  en: "Which section are you walking tomorrow?" },
  { group: "休憩・歓迎",        ja: "体調は大丈夫ですか?",                        en: "How are you feeling? Everything okay?" },
  { group: "チェックイン",       ja: "お名前を教えてください。",                      en: "May I have your name, please?" },
  { group: "チェックイン",       ja: "パスポートを見せていただけますか?(法律上の義務です)", en: "May I see your passport? It's a Japanese legal requirement for foreign guests." },
  { group: "チェックイン",       ja: "こちらの用紙にご記入ください。",                  en: "Please fill out this form." },
  { group: "ベッド案内",        ja: "下の段と上の段、どちらがお好みですか?",            en: "Would you prefer the lower bunk or the upper one?" },
  { group: "ベッド案内",        ja: "バックパックはこちらの棚にお置きください。",          en: "You can leave your backpack on this shelf." },
  { group: "ベッド案内",        ja: "貴重品はこちらのロッカーをお使いください。",          en: "Please use this locker for your valuables." },
  { group: "館内案内",         ja: "こちらがあなたのベッドです。",                   en: "This is your bed." },
  { group: "館内案内",         ja: "シャワーとトイレはこちらです。",                  en: "The showers and toilets are this way." },
  { group: "館内案内",         ja: "洗濯機と乾燥機は無料でお使いいただけます。",            en: "The washer and dryer are free to use." },
  { group: "館内案内",         ja: "Wi-Fi のパスワードはこちらに書いてあります。",          en: "The Wi-Fi password is written here." },
  { group: "館内案内",         ja: "21:00以降はお静かにお願いします。",                en: "Please keep the noise down after 9 PM." },
  { group: "館内案内",         ja: "喫煙は屋外の喫煙所でお願いします。",                en: "Smoking is only allowed at the outdoor smoking area." },
  { group: "館内案内",         ja: "山で出たゴミは、こちらで引き取りますよ。",             en: "We're happy to take your trail trash — no need to carry it." },
  { group: "朝・送り出し",       ja: "コーヒーとバナナはご自由にどうぞ。",                en: "Please help yourself to coffee and bananas." },
  { group: "朝・送り出し",       ja: "良い旅を!",                                en: "Have a great hike!" },
  { group: "困ったとき",        ja: "ゆっくり話していただけますか?",                  en: "Could you speak slowly, please?" },
  { group: "困ったとき",        ja: "少しだけ英語が話せます。",                      en: "I speak a little English." },
  { group: "困ったとき",        ja: "翻訳アプリを使いますね。",                      en: "Let me use a translation app." },
  { group: "儀式の説明",        ja: "明日のご安全を祈って、火打石を打たせていただきます。", en: "I'd like to send you off with a small ritual — striking flint behind you for a safe journey." },
  { group: "儀式の説明",        ja: "これは旅立つ人を見守る、古くからの日本の習俗です。",     en: "This is an old Japanese custom for blessing travelers before their journey." },
  { group: "儀式の説明",        ja: "火花が、悪いものを払うと言われています。",             en: "The sparks are believed to ward off misfortune." },
  { group: "儀式の説明",        ja: "明朝、神棚でご自分の手で安全祈願をしていただけます。",     en: "Tomorrow morning, you're invited to offer your own safety prayer at our kamidana — our household Shinto altar." },
  { group: "儀式の説明",        ja: "作法は、二礼・二拍手・一礼です。",                  en: "The form: two bows, two claps, one final bow." }
];

// === STYLES (CSS variables + reusable classes injected once) ===
const GLOBAL_CSS = `
  :root {
    --green: #2D4A3E;
    --green-light: #3A6355;
    --wood: #8B6914;
    --wood-light: #C4A35A;
    --wood-pale: #E8D5A3;
    --orange: #C8703C;
    --orange-light: #D4894F;
    --cream: #F5F0E6;
    --cream-dark: #EDE4D0;
    --text: #2A2A25;
    --text-light: #6B6555;
    --text-mute: #9A9587;
    --white: #FDFBF6;
    --rule: rgba(42,42,37,0.08);
    --shadow-sm: 0 1px 2px rgba(42,42,37,0.04);
    --shadow-md: 0 4px 16px rgba(42,42,37,0.06);
    --shadow-lg: 0 8px 32px rgba(42,42,37,0.10);
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; }
  .km-root {
    font-family: 'Zen Kaku Gothic New', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--text);
    line-height: 1.75;
    font-size: 15px;
    background:
      radial-gradient(ellipse at 10% 0%, rgba(200,112,60,0.06) 0%, transparent 40%),
      radial-gradient(ellipse at 90% 100%, rgba(45,74,62,0.05) 0%, transparent 40%),
      var(--cream);
    min-height: 100vh;
  }
  .km-shell {
    max-width: 540px;
    margin: 0 auto;
    background: var(--white);
    min-height: 100vh;
    position: relative;
    box-shadow: var(--shadow-lg);
  }
  .km-serif { font-family: 'Cormorant Garamond', 'Times New Roman', serif; }
  .km-numeral { font-family: inherit; font-weight: 600; letter-spacing: 0.02em; }

  /* HEADER */
  .km-header {
    position: sticky; top: 0; z-index: 30;
    background: rgba(253,251,246,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--rule);
    padding: 14px 20px 12px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .km-brand { font-family: 'Cormorant Garamond', serif; font-size: 1.15rem; letter-spacing: 0.2em; color: var(--green); }
  .km-brand-sub { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 0.7rem; color: var(--orange); letter-spacing: 0.05em; margin-top: 1px; }
  .km-icon-btn {
    width: 40px; height: 40px; border-radius: 50%;
    background: var(--cream); border: 1px solid var(--rule);
    display: grid; place-items: center; color: var(--green);
    transition: all 0.2s; cursor: pointer;
  }
  .km-icon-btn:active { transform: scale(0.92); background: var(--cream-dark); }

  /* CHIP BAR */
  .km-chips {
    position: sticky; top: 65px; z-index: 20;
    background: rgba(253,251,246,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--rule);
    overflow-x: auto;
    scrollbar-width: none;
    white-space: nowrap;
    padding: 10px 16px;
  }
  .km-chips::-webkit-scrollbar { display: none; }
  .km-chip {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 7px 14px; margin-right: 8px;
    border-radius: 999px;
    border: 1px solid var(--rule);
    background: var(--white);
    color: var(--text-light);
    font-size: 0.82rem; font-weight: 500;
    cursor: pointer; transition: all 0.2s;
    white-space: nowrap;
  }
  .km-chip:active { transform: scale(0.96); }
  .km-chip.active { background: var(--green); color: var(--cream); border-color: var(--green); }
  .km-chip-num { font-size: 0.78rem; font-weight: 600; opacity: 0.65; }
  .km-chip.active .km-chip-num { opacity: 0.85; }

  /* CONTENT */
  .km-main { padding: 24px 20px 140px; animation: fadeIn 0.35s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .km-section-num { font-size: 0.78rem; font-weight: 600; letter-spacing: 0.2em; color: var(--wood-light); margin-bottom: 6px; }
  .km-h2 {
    font-size: 1.45rem; font-weight: 500; color: var(--green); margin: 0 0 14px;
    line-height: 1.35;
  }
  .km-h2-sub { font-family: 'Cormorant Garamond', serif; font-style: italic; color: var(--orange); font-size: 0.95rem; letter-spacing: 0.05em; margin-bottom: 22px; }
  .km-h3 {
    font-size: 1.02rem; font-weight: 700; color: var(--text); margin: 28px 0 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .km-h3::before { content: ''; width: 3px; height: 16px; background: var(--green); display: inline-block; flex-shrink: 0; }
  .km-h4 { font-size: 0.9rem; font-weight: 700; color: var(--green-light); margin: 20px 0 8px; }
  .km-h2 + .km-h3 { margin-top: 0; }
  .km-p { margin: 0 0 16px; }
  .km-ul, .km-ol { padding-left: 22px; margin: 0 0 16px; }
  .km-ul li, .km-ol li { margin-bottom: 6px; }
  .km-ul li:last-child, .km-ol li:last-child { margin-bottom: 0; }

  /* BOXES */
  .km-note, .km-alert, .km-principle, .km-ritual {
    border-radius: 12px;
    padding: 14px 16px;
    margin: 0 0 16px;
    font-size: 0.88rem;
  }
  .km-note { background: var(--cream); border-left: 3px solid var(--wood-light); }
  .km-alert { background: rgba(200,112,60,0.07); border-left: 3px solid var(--orange); }
  .km-principle { background: var(--green); color: var(--cream); padding: 18px 18px; }
  .km-ritual {
    background: linear-gradient(140deg, var(--cream-dark), var(--cream));
    border: 1px solid var(--wood-pale);
    padding: 18px 20px;
    position: relative;
    overflow: hidden;
  }
  .km-ritual::before {
    content: '';
    position: absolute; top: 0; left: 0;
    width: 4px; height: 100%;
    background: linear-gradient(180deg, var(--orange), var(--wood-light), var(--green));
  }
  .km-ritual .km-box-label { color: var(--wood); }
  .km-ritual-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.1rem;
    color: var(--green);
    margin: 4px 0 8px;
    letter-spacing: 0.05em;
  }
  .km-ritual-title .ja {
    font-family: 'Zen Kaku Gothic New', sans-serif;
    font-size: 0.95rem;
    color: var(--text);
    margin-left: 10px;
    font-weight: 600;
  }
  .km-box-label {
    font-family: 'Cormorant Garamond', serif; font-size: 0.7rem;
    letter-spacing: 0.25em; text-transform: uppercase;
    margin-bottom: 6px; display: block;
  }
  .km-note .km-box-label { color: var(--wood); }
  .km-alert .km-box-label { color: var(--orange); }
  .km-principle .km-box-label { color: var(--wood-light); }

  /* CARDS */
  .km-card {
    background: var(--white); border: 1px solid var(--rule);
    border-radius: 14px; padding: 16px 18px; margin: 0 0 12px;
    box-shadow: var(--shadow-sm);
  }

  /* TABLES — render as label/value stacks on mobile */
  .km-table { display: flex; flex-direction: column; border-radius: 12px; overflow: hidden; border: 1px solid var(--rule); margin: 0 0 16px; }
  .km-row { display: grid; grid-template-columns: 100px 1fr; border-bottom: 1px solid var(--rule); }
  .km-row:last-child { border-bottom: none; }
  .km-row-label { background: var(--cream); color: var(--green); font-weight: 600; font-size: 0.82rem; padding: 12px 14px; }
  .km-row-value { padding: 12px 14px; font-size: 0.9rem; }
  .km-row-wide { grid-template-columns: 120px 1fr; }

  /* STEPS */
  .km-steps { counter-reset: step; list-style: none; padding: 0; margin: 0 0 16px; }
  .km-steps > li {
    counter-increment: step;
    padding: 12px 0 12px 42px;
    position: relative;
    border-bottom: 1px solid var(--rule);
    font-size: 0.92rem;
  }
  .km-steps > li:last-child { border-bottom: none; }
  .km-steps > li::before {
    content: counter(step, decimal-leading-zero);
    position: absolute; left: 0; top: 12px;
    font-size: 0.82rem;
    color: var(--orange); font-weight: 700; letter-spacing: 0.05em;
  }

  /* CHECKLIST */
  .km-checklist { list-style: none; padding: 0; margin: 0 0 16px; }
  .km-checklist li { padding: 8px 0 8px 30px; position: relative; border-bottom: 1px dashed var(--rule); font-size: 0.9rem; }
  .km-checklist li:last-child { border-bottom: none; }
  .km-checklist li::before {
    content: ''; position: absolute; left: 2px; top: 13px;
    width: 14px; height: 14px; border: 1.5px solid var(--green); border-radius: 3px;
  }

  /* PHRASE */
  .km-phrase {
    background: var(--white); border: 1px solid var(--rule);
    border-radius: 12px; padding: 12px 14px; margin: 0 0 8px;
    display: flex; align-items: flex-start; gap: 10px;
  }
  .km-phrase-text { flex: 1; min-width: 0; }
  .km-phrase-ja { font-size: 0.82rem; color: var(--text-mute); margin-bottom: 3px; }
  .km-phrase-en { font-size: 0.95rem; color: var(--text); font-weight: 500; line-height: 1.5; }
  .km-speak {
    flex-shrink: 0; width: 36px; height: 36px; border-radius: 50%;
    background: var(--cream); border: 1px solid var(--rule);
    display: grid; place-items: center; color: var(--orange);
    cursor: pointer; transition: all 0.15s;
  }
  .km-speak:active { transform: scale(0.9); background: var(--orange); color: var(--white); }
  .km-speak.speaking { background: var(--orange); color: var(--white); }
  .km-phrase-group { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.12em; color: var(--wood); margin: 20px 0 8px; }

  /* EMERGENCY GRID */
  .km-emergency-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 0 16px; }
  .km-emergency-card { background: var(--cream); border-top: 3px solid var(--orange); border-radius: 10px; padding: 12px 10px; text-align: center; text-decoration: none; color: inherit; transition: all 0.2s; }
  .km-emergency-card:active { transform: scale(0.96); background: var(--cream-dark); }
  .km-emergency-card-sub { font-size: 0.65rem; color: var(--text-mute); letter-spacing: 0.1em; margin-bottom: 2px; }
  .km-emergency-card-name { font-size: 0.78rem; font-weight: 600; margin-bottom: 3px; }
  .km-emergency-card-num { font-size: 1.2rem; font-weight: 700; color: var(--orange); }

  /* BOTTOM TABS */
  .km-tabs {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
    background: rgba(253,251,246,0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid var(--rule);
    padding: 8px 4px calc(8px + env(safe-area-inset-bottom));
    display: flex; justify-content: center;
  }
  .km-tabs-inner { max-width: 540px; width: 100%; display: grid; grid-template-columns: repeat(4, 1fr); }
  .km-tab {
    display: flex; flex-direction: column; align-items: center; gap: 3px;
    padding: 8px 4px; background: none; border: none;
    color: var(--text-mute); cursor: pointer; transition: all 0.2s;
  }
  .km-tab:active { transform: scale(0.93); }
  .km-tab.active { color: var(--green); }
  .km-tab-label { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.05em; }
  .km-tab-en { font-family: 'Cormorant Garamond', serif; font-size: 0.62rem; font-style: italic; opacity: 0.7; margin-top: -1px; }

  /* EMERGENCY FAB */
  .km-fab {
    position: fixed; right: max(16px, calc(50% - 250px));
    bottom: calc(80px + env(safe-area-inset-bottom)); z-index: 35;
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, #C8703C, #A8542A);
    color: var(--white); border: none;
    display: grid; place-items: center; cursor: pointer;
    box-shadow: 0 6px 20px rgba(200,112,60,0.45);
    transition: all 0.2s;
  }
  .km-fab:active { transform: scale(0.92); }
  .km-fab::after {
    content: ''; position: absolute; inset: -4px;
    border-radius: 50%; border: 2px solid rgba(200,112,60,0.3);
    animation: pulseRing 2.4s ease-out infinite;
  }
  @keyframes pulseRing {
    0% { transform: scale(0.95); opacity: 0.8; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  /* OVERLAYS */
  .km-overlay {
    position: fixed; inset: 0; z-index: 50;
    background: rgba(42,42,37,0.5);
    backdrop-filter: blur(4px);
    display: flex; align-items: flex-end; justify-content: center;
    animation: fadeIn 0.2s ease;
  }
  .km-overlay.search { align-items: flex-start; padding-top: 60px; }
  .km-sheet {
    background: var(--white); width: 100%; max-width: 540px;
    border-radius: 24px 24px 0 0;
    padding: 24px 20px calc(24px + env(safe-area-inset-bottom));
    animation: slideUp 0.3s ease;
    max-height: 90vh; overflow-y: auto;
  }
  .km-search-panel {
    background: var(--white); width: calc(100% - 32px); max-width: 508px;
    border-radius: 16px; padding: 16px;
    animation: slideDown 0.25s ease;
    max-height: 80vh; display: flex; flex-direction: column;
  }
  @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @keyframes slideDown { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

  .km-sheet-grip { width: 36px; height: 4px; background: var(--rule); border-radius: 2px; margin: 0 auto 16px; }
  .km-sheet-title { font-family: 'Cormorant Garamond', serif; font-size: 1.2rem; color: var(--green); letter-spacing: 0.08em; margin-bottom: 4px; text-align: center; }
  .km-sheet-sub { text-align: center; color: var(--text-mute); font-size: 0.8rem; margin-bottom: 20px; }

  .km-emergency-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 18px; margin-bottom: 10px;
    border-radius: 14px; background: var(--cream);
    text-decoration: none; color: inherit;
    border-left: 4px solid;
    transition: all 0.15s;
  }
  .km-emergency-row:active { transform: scale(0.98); background: var(--cream-dark); }
  .km-emergency-label { font-size: 0.92rem; font-weight: 700; }
  .km-emergency-sub { font-size: 0.72rem; color: var(--text-mute); margin-top: 2px; }
  .km-emergency-tel { font-size: 1.05rem; font-weight: 700; letter-spacing: 0.02em; }

  /* SEARCH */
  .km-search-input-wrap { display: flex; align-items: center; gap: 10px; border: 1px solid var(--rule); border-radius: 12px; padding: 10px 14px; background: var(--cream); }
  .km-search-input { flex: 1; border: none; background: transparent; outline: none; font-size: 0.95rem; color: var(--text); font-family: inherit; }
  .km-search-results { margin-top: 14px; overflow-y: auto; flex: 1; }
  .km-search-result {
    padding: 12px; border-radius: 10px; margin-bottom: 6px;
    background: var(--cream); cursor: pointer; transition: background 0.15s;
  }
  .km-search-result:active { background: var(--cream-dark); }
  .km-search-result-title { font-size: 0.85rem; font-weight: 700; color: var(--green); display: flex; align-items: center; gap: 8px; }
  .km-search-result-num { color: var(--wood-light); font-size: 0.78rem; font-weight: 600; }
  .km-search-result-snippet { font-size: 0.8rem; color: var(--text-light); margin-top: 4px; line-height: 1.5; }
  .km-search-empty { text-align: center; color: var(--text-mute); padding: 32px 16px; font-size: 0.85rem; }

  /* PENDING LIST */
  .km-icon-btn { position: relative; }
  .km-badge {
    position: absolute; top: -3px; right: -3px;
    min-width: 17px; height: 17px; border-radius: 9px;
    background: var(--orange); color: var(--white);
    font-size: 0.62rem; font-weight: 700;
    display: grid; place-items: center; padding: 0 4px;
  }
  .km-pending-item {
    background: var(--cream); border-radius: 12px;
    padding: 14px 16px; margin-bottom: 10px;
    border-left: 3px solid var(--wood-light);
  }
  .km-pending-topic { font-weight: 700; font-size: 0.9rem; color: var(--green); margin-bottom: 4px; }
  .km-pending-detail { font-size: 0.82rem; color: var(--text-light); line-height: 1.6; margin-bottom: 8px; }
  .km-pending-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .km-pending-askto { color: var(--wood); font-weight: 600; font-size: 0.72rem; }
  .km-pending-link {
    color: var(--orange); display: inline-flex; align-items: center; gap: 2px;
    cursor: pointer; background: none; border: none;
    font-family: inherit; font-size: 0.72rem; padding: 0;
  }

  /* COVER (welcome) */
  .km-cover { padding: 0 0 14px; border-bottom: 1px solid var(--rule); margin-bottom: 20px; }
  .km-cover-label { font-family: 'Cormorant Garamond', serif; font-size: 0.72rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--orange); margin-bottom: 10px; }
  .km-cover-title { font-size: 1.55rem; font-weight: 500; line-height: 1.4; color: var(--text); margin-bottom: 6px; }
  .km-cover-sub { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 1.05rem; color: var(--green); margin-bottom: 12px; }
  .km-cover-meta { display: flex; gap: 18px; font-size: 0.75rem; color: var(--text-light); flex-wrap: wrap; }
  .km-cover-meta-item span { display: block; font-family: 'Cormorant Garamond', serif; font-size: 0.65rem; letter-spacing: 0.2em; color: var(--text-mute); margin-bottom: 2px; }

  /* SIDEBAR — desktop only */
  .km-sidebar { display: none; }
  .km-sidebar-brand-title { font-family: 'Cormorant Garamond', serif; font-size: 1.5rem; letter-spacing: 0.2em; color: var(--green); margin-bottom: 4px; }
  .km-sidebar-tagline { font-family: 'Cormorant Garamond', serif; font-style: italic; color: var(--orange); font-size: 0.85rem; letter-spacing: 0.05em; margin-bottom: 8px; }
  .km-sidebar-sub { font-family: 'Cormorant Garamond', serif; font-size: 0.7rem; letter-spacing: 0.3em; text-transform: uppercase; color: var(--text-mute); }
  .km-sidebar-search-btn {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 10px 14px;
    background: var(--white); border: 1px solid var(--rule);
    border-radius: 10px; color: var(--text-light);
    font-size: 0.82rem; cursor: pointer; font-family: inherit;
    margin: 20px 0 24px;
    transition: all 0.2s;
  }
  .km-sidebar-search-btn:hover { background: var(--white); border-color: var(--green-light); color: var(--green); box-shadow: var(--shadow-sm); }
  .km-sidebar-nav { flex: 1; overflow-y: auto; padding-right: 6px; margin-right: -6px; }
  .km-sidebar-nav::-webkit-scrollbar { width: 4px; }
  .km-sidebar-nav::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 2px; }
  .km-sidebar-group { margin-bottom: 22px; }
  .km-sidebar-group-label {
    font-family: 'Cormorant Garamond', serif;
    font-size: 0.7rem; letter-spacing: 0.25em;
    text-transform: uppercase; color: var(--text-mute);
    margin-bottom: 8px; padding-bottom: 6px;
    border-bottom: 1px solid var(--rule);
    display: flex; align-items: center; gap: 8px;
  }
  .km-sidebar-link {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 8px 12px;
    background: none; border: none; text-align: left;
    color: var(--text-light); font-size: 0.85rem;
    cursor: pointer; border-radius: 8px;
    font-family: inherit; transition: all 0.15s;
    border-left: 2px solid transparent;
    line-height: 1.4;
  }
  .km-sidebar-link:hover { background: var(--white); color: var(--green); }
  .km-sidebar-link.active { background: var(--white); color: var(--green); font-weight: 600; border-left-color: var(--orange); box-shadow: var(--shadow-sm); }
  .km-sidebar-num { font-size: 0.78rem; color: var(--wood-light); font-weight: 600; min-width: 22px; }
  .km-sidebar-link.active .km-sidebar-num { color: var(--orange); }
  .km-sidebar-bottom { margin-top: auto; padding-top: 16px; border-top: 1px solid var(--rule); }
  .km-sidebar-emergency-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 13px;
    background: linear-gradient(135deg, var(--orange), #A8542A);
    color: var(--white); border: none; border-radius: 10px;
    font-family: inherit; font-size: 0.88rem; font-weight: 600;
    letter-spacing: 0.05em; cursor: pointer;
    box-shadow: 0 4px 14px rgba(200,112,60,0.3);
    transition: all 0.2s;
  }
  .km-sidebar-emergency-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(200,112,60,0.4); }
  .km-sidebar-emergency-btn:active { transform: translateY(0); }

  /* === RESPONSIVE: TABLET LANDSCAPE & DESKTOP (>=1024px) === */
  @media (min-width: 1024px) {
    .km-root {
      background:
        radial-gradient(ellipse at 0% 0%, rgba(200,112,60,0.05) 0%, transparent 50%),
        radial-gradient(ellipse at 100% 100%, rgba(45,74,62,0.04) 0%, transparent 50%),
        var(--cream);
    }
    .km-shell {
      max-width: 1180px;
      margin: 28px auto;
      min-height: calc(100vh - 56px);
      display: grid;
      grid-template-columns: 280px 1fr;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
    }
    .km-header, .km-chips, .km-tabs, .km-fab { display: none !important; }
    .km-sidebar {
      display: flex; flex-direction: column;
      background: var(--cream);
      border-right: 1px solid var(--rule);
      padding: 36px 22px 22px;
      position: sticky; top: 0;
      height: calc(100vh - 56px);
      max-height: calc(100vh - 56px);
      align-self: start;
      overflow: hidden;
    }
    .km-main {
      padding: 56px 64px 96px;
      max-width: 780px;
      margin: 0 auto;
      width: 100%;
      animation: fadeIn 0.3s ease;
    }
    .km-section-num { font-size: 0.85rem; margin-bottom: 8px; }
    .km-h2 { font-size: 1.95rem; margin-bottom: 18px; }
    .km-h2-sub { font-size: 1.1rem; margin-bottom: 32px; }
    .km-h3 { font-size: 1.15rem; margin: 34px 0 14px; }
    .km-h4 { font-size: 0.95rem; margin: 22px 0 10px; }
    .km-p, .km-ul li, .km-ol li { font-size: 0.95rem; }
    .km-cover { padding: 0 0 18px; margin-bottom: 28px; }
    .km-card { padding: 18px 22px; }
    .km-row { grid-template-columns: 130px 1fr; }
    .km-row-wide { grid-template-columns: 150px 1fr; }
    .km-row-value { font-size: 0.95rem; }
    .km-note, .km-alert, .km-ritual { font-size: 0.92rem; padding: 18px 22px; margin: 0 0 18px; }
    .km-principle { padding: 22px 24px; }
    .km-overlay { align-items: center; }
    .km-overlay.search { padding-top: 0; }
    .km-sheet { max-width: 480px; border-radius: 18px; }
    .km-search-panel { max-width: 560px; }
    .km-emergency-grid { gap: 14px; }
    .km-emergency-card-num { font-size: 1.35rem; }
  }

  /* === RESPONSIVE: WIDE DESKTOP (>=1400px) === */
  @media (min-width: 1400px) {
    .km-shell { max-width: 1280px; grid-template-columns: 300px 1fr; }
    .km-main { padding: 64px 80px 96px; max-width: 820px; }
    .km-sidebar { padding: 40px 26px 24px; }
  }
`;

// === HELPERS ===
const speak = (text, lang = "en-US") => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = 0.9;
  window.speechSynthesis.speak(u);
};

const Phrase = ({ ja, en }) => {
  const [speaking, setSpeaking] = useState(false);
  const handleSpeak = () => {
    setSpeaking(true);
    speak(en);
    setTimeout(() => setSpeaking(false), Math.min(en.length * 80, 4000));
  };
  return (
    <div className="km-phrase">
      <div className="km-phrase-text">
        <div className="km-phrase-ja">{ja}</div>
        <div className="km-phrase-en">{en}</div>
      </div>
      <button className={`km-speak ${speaking ? "speaking" : ""}`} onClick={handleSpeak} aria-label="Speak">
        <Volume2 size={16} />
      </button>
    </div>
  );
};

const Row = ({ label, children, wide }) => (
  <div className={`km-row ${wide ? "km-row-wide" : ""}`}>
    <div className="km-row-label">{label}</div>
    <div className="km-row-value">{children}</div>
  </div>
);

const Note = ({ label, children }) => (
  <div className="km-note">
    {label && <span className="km-box-label">{label}</span>}
    {children}
  </div>
);
const Alert = ({ label, children }) => (
  <div className="km-alert">
    {label && <span className="km-box-label">{label}</span>}
    {children}
  </div>
);
const Principle = ({ label, children }) => (
  <div className="km-principle">
    {label && <span className="km-box-label">{label}</span>}
    {children}
  </div>
);

// === SECTION CONTENT ===
const SectionContent = ({ id }) => {
  switch (id) {

    case "welcome": return (
      <>
        <div className="km-cover">
          <div className="km-cover-meta">
            <div className="km-cover-meta-item"><span>Version</span>5.2</div>
            <div className="km-cover-meta-item"><span>Issued</span>2026.05</div>
            <div className="km-cover-meta-item"><span>Operator</span>肉のおくだ</div>
          </div>
        </div>

        <p className="km-p">このマニュアルは、KRAFT BASE のスタッフとして安心して業務に取り組んでいただくための手引きです。困ったときに開いていただく「辞書」として活用してください。</p>

        <Principle label="Our Concept">
          <p style={{ margin: 0 }}>KRAFT BASE のテーマは <strong>「Unplug to recharge.(つないでいたものを外して、力を取り戻す)」</strong>。デジタルではない心地よさ。足し算ではなく、引き算。余計な物を置かず、余白を保つ。スマートフォンや日常から少し離れて、自然と人とのつながりの中で心身を整えてもらう場所です。スタッフの私たちが大切にしたいのは、この体験を邪魔せず、そっと支えること。</p>
        </Principle>

        <h3 className="km-h3">サービスの三つの柱</h3>
        <p className="km-p">ゲストが求めているのは、完璧なサービスではなく<strong>心地よい時間</strong>。それを支えるのが、この三つの柱です。</p>

        <div style={{ display: "grid", gap: 10, margin: "0 0 16px" }}>
          {[
            { en: "Cleanliness", ja: "清潔", desc: "徹底した清掃。" },
            { en: "Assurance", ja: "安心", desc: "わからないことを、いつでも聞ける雰囲気。" },
            { en: "Silence", ja: "静寂", desc: "KRAFT BASE のBGMは、風の音、鳥の声。" }
          ].map((p, i) => (
            <div key={i} className="km-card" style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 14 }}>
              <div style={{ minWidth: 92 }}>
                <div style={{ fontFamily: "Cormorant Garamond, serif", fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--wood)" }}>{p.en}</div>
                <div style={{ fontWeight: 700, color: "var(--green)", fontSize: "1.05rem" }}>{p.ja}</div>
              </div>
              <div style={{ fontSize: "0.88rem", color: "var(--text-light)" }}>{p.desc}</div>
            </div>
          ))}
        </div>

        <h3 className="km-h3">スタッフの役割</h3>
        <ul className="km-ul">
          <li>世界中から熊野古道を歩きに来るトレッカー、夏に川遊びを楽しむご家族、静かな滞在を求めるワーケーション利用者を温かく迎える</li>
          <li>清潔で安全な空間を保ち、ゲストが「ここに来てよかった」と思える時間を提供する</li>
          <li>地域の魅力を伝える窓口になる。完璧な知識は不要。「自分が好きな場所」を素直に紹介すれば十分</li>
        </ul>

        <h3 className="km-h3">ゲスト体験のストーリー</h3>
        <p className="km-p">KRAFT BASE には3つの主要なゲスト層があり、過ごし方が異なります。それぞれの代表的な流れを把握しておきましょう(各場面でゲストが何を求めているかを意識する)。</p>

        {[
          { label: "① トレッカー(春・秋)", arc: [
            { scene: "歩く", state: "古道を歩きながらKRAFT BASEに向かう", role: "到着前の問い合わせに丁寧に応答" },
            { scene: "到着", state: "疲れと達成感、安心したい", role: "笑顔で迎え、和室で座って受付。梅ジュースとみかんでひと息" },
            { scene: "シャワー", state: "旅モード → リラックスモードへ", role: "シャワー・着替え・洗濯をスムーズに案内" },
            { scene: "交流", state: "ダイニングで他のゲストと語らう", role: "自然な距離感で会話を促す。押し付けない" },
            { scene: "静けさ", state: "南側和室・縁側・カプセルでひとり時間", role: "静かな環境を守る。声かけは控えめに" },
            { scene: "眠る", state: "翌日に備えて休む", role: "火打石でお見送り、静かな照明で送り出す" },
            { scene: "また歩く", state: "セルフコーヒー、神棚で安全祈願、次の宿へ", role: "朝の準備を整え、Have a great hike! で送り出す" }
          ]},
          { label: "② ファミリー(夏)", arc: [
            { scene: "到着", state: "川遊び目的の家族。安全に過ごしたい", role: "和室にご案内、ウェルカムドリンク。川の注意事項を伝える" },
            { scene: "川遊び", state: "子供と一緒に川へ", role: "ライフジャケット2着を貸出、安全な浅瀬を案内。増水時は自粛を促す" },
            { scene: "夕食", state: "お弁当(BBQ利用時もあり)", role: "お弁当の引き渡し。BBQ利用時は後始末・消火を確認" },
            { scene: "くつろぎ", state: "家族で和室・縁側でゆっくり", role: "一軒貸しに近い距離感で静かに見守る" },
            { scene: "眠る", state: "翌日に備えて休む", role: "火打石でお見送り(家族にも)" },
            { scene: "朝・出発", state: "セルフ朝食、神棚で祈願", role: "朝の準備、笑顔で見送り" }
          ]},
          { label: "③ ワーケーション(オフシーズン)", arc: [
            { scene: "チェックイン", state: "静かに長く滞在して働きたい", role: "Wi-Fi・静けさ・共用部の使い方を案内" },
            { scene: "仕事", state: "ダイニングや和室で作業", role: "BGMを流さない静けさを保つ。過度に構わない" },
            { scene: "連泊", state: "数日〜の滞在", role: "清掃・リネン交換の要否をコミュニケーションで決める" },
            { scene: "休憩", state: "自然の中でリフレッシュ", role: "川・古道・縁側など気分転換の場所を案内" },
            { scene: "出発", state: "ゆったりチェックアウト", role: "お礼メッセージ(後日、ルッコロー)" }
          ]}
        ].map((group) => (
          <div key={group.label}>
            <h4 className="km-h4">{group.label}</h4>
            {group.arc.map((s, i) => (
              <div key={i} className="km-card" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span className="km-numeral" style={{ color: "var(--orange)", fontSize: "0.95rem" }}>{String(i+1).padStart(2,"0")}</span>
                  <strong style={{ color: "var(--green)" }}>{s.scene}</strong>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-light)", marginBottom: 4 }}>{s.state}</div>
                <div style={{ fontSize: "0.85rem" }}>→ {s.role}</div>
              </div>
            ))}
          </div>
        ))}
      </>
    );

    case "facility": return (
      <>
        <h3 className="km-h3">基本情報</h3>
        <div className="km-table km-row-wide">
          <Row label="施設名" wide>KRAFT BASE(クラフトベース)</Row>
          <Row label="所在地" wide>和歌山県新宮市熊野川町上長井字小和瀬134番地3</Row>
          <Row label="運営" wide>肉のおくだ</Row>
          <Row label="収容人数" wide>6名(二段ベッド×3 / 貸切時はマットレスを和室に並べる)</Row>
          <Row label="代表連絡先" wide>080-8032-9762</Row>
        </div>

        <h3 className="km-h3">スタッフ体制(1日)</h3>
        <div className="km-table">
          <Row label="9:00〜13:00">ルッコロー(問い合わせ対応・リモート)</Row>
          <Row label="13:00〜17:00">日中スタッフ(清掃・準備・チェックイン)</Row>
          <Row label="17:00〜20:00頃">モーリー(夜の業務 / 終了時刻は20:00目安)</Row>
          <Row label="20:00以降">無人。緊急連絡先は施設案内に記載(チェックイン時に配布)</Row>
        </div>

        <h3 className="km-h3">シーズン特性</h3>
        <div className="km-card" style={{ padding: 0, overflow: "hidden" }}>
          {[
            { period: "3・4・5・9・10・11月", guest: "外国人トレッカー", note: "英語対応、熊野古道の情報、早朝出発の手配" },
            { period: "7・8月", guest: "日本人ファミリー", note: "川遊びスポット、お弁当、安全配慮" },
            { period: "6月・12〜2月", guest: "ワーケーション利用者", note: "Wi-Fi環境、静けさ、長期滞在の快適性" }
          ].map((s, i) => (
            <div key={i} style={{ padding: "14px 16px", borderBottom: i < 2 ? "1px solid var(--rule)" : "none" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--wood)", letterSpacing: "0.06em", marginBottom: 4 }}>{s.period}</div>
              <div style={{ fontWeight: 600, color: "var(--green)", fontSize: "0.92rem", marginBottom: 4 }}>{s.guest}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>{s.note}</div>
            </div>
          ))}
        </div>

        <h3 className="km-h3">設備:キッチン</h3>
        <ul className="km-ul">
          <li>自炊可。基本的な調理器具を完備</li>
          <li>使用後は必ず洗って元の場所へ戻すルール</li>
          <li>食材の冷蔵庫保管は退去時持ち帰りが原則</li>
        </ul>

        <h3 className="km-h3">設備:Wi-Fi</h3>
        <ul className="km-ul">
          <li>SSID とパスワードは館内掲示</li>
          <li>テーマは Unplug だが、ワーケーション利用者のため回線は安定運用</li>
          <li>不調時はルーター再起動 → 改善しなければ運営へ連絡</li>
        </ul>

        <h3 className="km-h3">館内販売</h3>
        <ul className="km-ul">
          <li>インスタント食品・お菓子・飲み物(ビール含む)など</li>
          <li>購入可能時間:<strong>スタッフ在館時のみ(13:00〜20:00目安)</strong>。無人時間帯は販売なし</li>
          <li>決済は Square / PayPay が基本。<strong>現金は最低限のお釣りだけ用意</strong>(本当にどうしようもない時のみ)</li>
          <li>チェックイン時に「ご入用の方は20時までにどうぞ」と一言添えておく</li>
        </ul>

        <h3 className="km-h3">夕食:肉のおくだのお弁当</h3>
        <ul className="km-ul">
          <li><strong>小口周辺に夕食を取れる飲食店はない。</strong>夕食は「お弁当(事前注文)/ 自炊 / カップ麺」の三択</li>
          <li>注文は<strong>事前オンライン(3日前まで)が建前</strong>。予約時・予約確認メッセージでもそう案内する</li>
          <li><strong>実際には当日・現地の手配も可能</strong>だが、事前にこの情報は明かさない(常態化を防ぐため)。当日手配分は<strong>宿で決済</strong></li>
          <li>毎日<strong>17:00〜18:00</strong>に、モーリーが配達</li>
        </ul>

        <h3 className="km-h3">館内ルール</h3>
        <div className="km-table">
          <Row label="チェックイン">15:00〜19:00。19:00〜20:00は要事前連絡。最終20:00</Row>
          <Row label="チェックアウト">〜 10:00</Row>
          <Row label="静粛時間">21:00 〜 6:00</Row>
          <Row label="喫煙">館内全面禁煙。喫煙は和室を出て右側の喫煙スペース(吸い殻入れあり)のみ</Row>
          <Row label="飲酒">共用部での節度ある飲酒は可</Row>
          <Row label="土足">玄関で靴を脱ぐ(スリッパなし)</Row>
          <Row label="ペット">不可(補助犬は要事前相談)</Row>
          <Row label="同伴">宿泊登録のないゲストの滞在不可</Row>
          <Row label="施錠">宿の玄関は施錠しない。スタッフルームはスタッフ不在時に施錠</Row>
          <Row label="ゴミ">もえる・もえない・びんに分別。山から持ち帰ったトレッカーのゴミも引き受ける</Row>
        </div>
      </>
    );

    case "area": return (
      <>
        <h3 className="km-h3">熊野古道(中辺路ルート)</h3>
        <ul className="km-ul">
          <li>小口は中辺路の中間地点。前後の宿(本宮側・那智側)への移動経路を把握</li>
          <li>古道入口までの徒歩時間、迂回路の有無を確認</li>
          <li>雨天時は滑りやすい箇所があるため注意喚起</li>
        </ul>

        <h3 className="km-h3">川遊びスポット</h3>
        <ul className="km-ul">
          <li>徒歩圏内の安全な浅瀬を把握</li>
          <li>更衣・トイレが使える場所を案内</li>
        </ul>

        <h3 className="km-h3">飲食・売店</h3>
        <ul className="km-ul">
          <li><strong>小口周辺に夕食を取れる飲食店はない。</strong>夕食は §02 の三択(お弁当 / 自炊 / カップ麺)を案内</li>
          <li>「肉のおくだ」のお弁当は事前オンライン注文(3日前締切)が建前。当日手配は裏で可能だが事前に案内しない(§02)</li>
          <li>最寄りのコンビニ・スーパーまでの距離と交通手段</li>
        </ul>

        <h3 className="km-h3">交通</h3>
        <ul className="km-ul">
          <li>路線バスの時刻表は受付に常備</li>
          <li>新宮駅・紀伊勝浦駅までの所要時間(クイックリファレンスに集約予定)</li>
        </ul>
      </>
    );

    case "mindset": return (
      <>
        <Principle label="Foundation">
          <p style={{ margin: 0 }}>スタッフに最も大事なのは、<strong>思いやりの気持ち</strong>。ゲストが求めているのは完璧なサービスではなく、心地よい時間です。このマニュアルは、そのための道具にすぎません。</p>
        </Principle>

        <h3 className="km-h3">5つの心がけ</h3>
        <ol className="km-ol">
          <li><strong>笑顔と挨拶を欠かさない</strong> — ゲストとすれ違ったら必ず声をかける。「こんにちは」「Hello」のひと言で空気が変わります</li>
          <li><strong>押し付けがましくない、さりげないおもてなし</strong> — 過剰な案内や声かけはしない。必要なときに自然にそばにいる距離感を</li>
          <li><strong>「わからない」は正直に</strong> — 知ったかぶりはしない。「確認しますね / Let me check」と伝え、必ず後で回答</li>
          <li><strong>地元を知り尽くした頼もしさ</strong> — 完璧でなくていい。自分の言葉で、自分の好きな場所を伝える</li>
          <li><strong>ゲストの旅を尊重する</strong> — 熊野古道は信仰の道。神聖さ・自然への敬意を忘れない</li>
        </ol>

        <Note label="Tone of voice">
          丁寧だけど堅すぎない、信頼できる友達のような語り口。ホテルのフォーマルな対応より、地元の親戚の家に泊まりに来たような温かさを目指します。
        </Note>

        <h3 className="km-h3">三つの柱を日々の振る舞いに</h3>
        <div className="km-table">
          <Row label="清潔">徹底した清掃(§06)。「まあいいか」を残さない。ゲストの目に映る場所すべてが対象</Row>
          <Row label="安心">いつでも聞ける雰囲気を作る。ゲストと目が合ったら、手を止めて応じる。忙しそうな空気を出さない</Row>
          <Row label="静寂">館内にBGMは流さない。風の音と鳥の声が KRAFT BASE の音楽。スタッフ自身の物音・話し声も静けさの一部と心得る</Row>
        </div>

        <h3 className="km-h3">この空間を守る — 勝手に足さない</h3>
        <p className="km-p">KRAFT BASE の価値は、置いてある物ではなく、<strong>置いていない物</strong>にあります。余白と静けさそのものが商品です。だからこそ、ひとつ徹底したいお願いがあります。</p>

        <Principle label="Rule">
          <p style={{ margin: 0 }}>スタッフは、貼り紙・案内メモを勝手に貼らない。私物・便利グッズ・装飾を勝手に置かない。何かを足したくなったら、まず「引けないか」を考える。</p>
        </Principle>

        <p className="km-p">「使用後は片付けてください」「ここは○○です」——よかれと思って貼る一枚の紙が、この宿が避けたいもの(雑多な情報、生活感、ホテルらしい注意書きの多さ)を呼び込みます。必要な案内は施設案内の1枚にすべて集約済みなので、個別の貼り紙はそもそも要りません。</p>

        <p className="km-p">気づいた改善は、自分で足さず、<strong>まず運営に提案</strong>してください。判断するのは運営です。引くことが、ここでの親切です。</p>
      </>
    );

    case "morning": return (
      <>
        <p className="km-p">朝は<strong>セルフサービス</strong>が基本です。早朝出発のトレッカーが多いため、前夜のうちに準備を整え、ゲストが自分のペースで出発できるようにします。</p>

        <h3 className="km-h3">⑦ 朝(6:00〜) 出発準備</h3>
        <ul className="km-ul">
          <li><strong>セルフコーヒー</strong> — 豆のまま容器にセット。計量・挽き・抽出までゲストが自由に(フレンチプレス3台 / 手挽きミル2台)。自分で挽いて淹れる時間も Unplug の体験</li>
          <li><strong>リビングのバナナスタンド</strong> — 宿泊人数+2本目安(前夜にモーリーがセット)</li>
          <li><strong>和室ちゃぶ台のみかん</strong> — 常設。減っていたら補充</li>
          <li>季節や仕入れによってプラスαの一品が出ることもある(スタッフアプリの引き継ぎで確認)</li>
        </ul>

        <h3 className="km-h3">⑧ 神棚で安全祈願(ゲスト自身)</h3>
        <p className="km-p">出発前、ゲスト自身が<strong>神棚で安全祈願の祈り</strong>を捧げます。スタッフの介在は不要ですが、ゲストが迷わずに祈れるよう、神棚の場所と作法の案内を整えておくのがスタッフの役割です。</p>

        <div className="km-ritual">
          <span className="km-box-label">Ritual</span>
          <div className="km-ritual-title">Kamidana<span className="ja">神棚</span></div>
          <p style={{ margin: "0 0 10px" }}>神棚(かみだな)は、日本の家庭やお店に祀られる小さな神社のような場所。家やお店を守る神様(かみ)が宿るとされます。旅立つ朝、ゲストご自身の手で安全祈願をしていただきます。</p>
          <p style={{ margin: 0 }}>作法は <strong>二礼・二拍手・一礼(にれい・にはくしゅ・いちれい)</strong>。<br/>① 深いお辞儀を2回 → ② 手を2回叩く → ③ 願いを心の中で唱える → ④ 最後にもう1回お辞儀。</p>
        </div>

        <h4 className="km-h4">スタッフの準備(前夜・朝)</h4>
        <ul className="km-ul">
          <li>神棚周辺を清掃、ホコリを払う</li>
          <li>作法はゲストにお渡しする紙(施設案内)に記載(神棚前にカードは置かない)</li>
          <li>夜のお見送り時に、翌朝の神棚祈願を口頭でも案内</li>
          <li>朝、ゲストが祈っている際は遠くで見守るに留め、声をかけない</li>
        </ul>

        <Note label="Why this matters">
          熊野古道は信仰の道です。出発の朝にご自身の手で祈りを捧げる体験は、KRAFT BASE の「Unplug to recharge」というコンセプトに深く重なります。デジタル機器に触れる前に、自分の手と声で祈る。それが「次の歩み」への切り替えになります。
        </Note>

        <h3 className="km-h3">⑨ チェックアウト(〜10:00)</h3>
        <ol className="km-steps">
          <li><strong>セルフチェックアウト</strong> — 鍵の返却は不要(宿は施錠しない方針)。ベッド周りの忘れ物確認はゲストにお任せ</li>
          <li>受付には<strong>「Have a great hike! / 良い旅を」</strong>のメッセージボードを掲示</li>
          <li>その場にいる場合は笑顔で送り出す:<em>"Have a great hike!"</em></li>
          <li>追加料金がある場合は前日のうちに精算(朝はバタつくため)</li>
          <li>チェックアウト後、忘れ物のチェック・連絡先の控え</li>
        </ol>

        <Note label="Tip">
          外国人トレッカーは熊野古道の次の宿への移動が控えています。前夜のうちにバスの時刻や徒歩ルートを伝えておくと、朝バタつかずに済みます。
        </Note>

        <h3 className="km-h3">チェックアウト後:お礼とレビュー依頼(ルッコロー)</h3>
        <ul className="km-ul">
          <li>当日の9:00〜13:00の枠で、ルッコローがチェックアウト済みゲストへ<strong>予約サイト経由のお礼メッセージ</strong>を送る</li>
          <li>内容:滞在への感謝 + 「ご滞在が良ければレビューをいただけると嬉しいです」のさりげない一言</li>
          <li><strong>火打石や見送りの場面で口頭のレビュー依頼はしない。</strong>儀式は祈りのままに、営業に使わない。体験が本物であれば、後日の一通で十分</li>
        </ul>
      </>
    );

    case "midday": return (
      <>
        <p className="km-p">スタッフ業務は<strong>13:00〜17:00</strong>。13時に出勤、清掃・洗濯・補充を済ませて15時のチェックインに備えます。<strong>9:00〜13:00 の問い合わせはルッコローが担当</strong>(業務時間外)。</p>

        <h3 className="km-h3">13:00 出勤 — まずやること</h3>
        <ol className="km-steps">
          <li>出勤(スタッフルームを開錠)、スタッフアプリで前日シフト・ルッコローからの引き継ぎを確認</li>
          <li>朝食セットの片付け — フレンチプレス・手挽きミルの洗浄、コーヒー豆・バナナ・みかんの残量確認</li>
          <li>ベッドメイキング(当日チェックイン人数分)。家族貸切日のマットレス配置は、家族と会ってから決める(§10 参照)</li>
          <li>タオル・リネンの洗濯 → 乾燥</li>
          <li>シャワー・トイレ・キッチン・寝室の清掃</li>
          <li>不足品の補充</li>
        </ol>

        <h3 className="km-h3">清掃 — 客室(ドミトリー)</h3>
        <ol className="km-ol">
          <li>窓を開けて換気</li>
          <li>使用済みリネン(シーツ・枕カバー・タオル)を回収し、洗濯カゴへ</li>
          <li>ベッドのマットレスを軽く拭き、清潔なシーツを敷く</li>
          <li>枕カバー、掛け布団カバーを交換</li>
          <li>床を掃除機</li>
          <li>個別ライト、コンセント、ベッド下の確認</li>
          <li>アメニティをセット</li>
        </ol>

        <h3 className="km-h3">清掃 — 水回り</h3>
        <ul className="km-ul">
          <li>シャワー室は使用後に必ず水気を拭き取る(カビ防止)</li>
          <li>排水溝の髪の毛を毎回除去</li>
          <li>洗面台は鏡まで磨き上げる</li>
          <li>トイレは便器・床・手すりを除菌</li>
          <li>消耗品(トイレットペーパー、ハンドソープ)の残量確認</li>
        </ul>

        <h3 className="km-h3">清掃 — 共用部</h3>
        <ul className="km-ul">
          <li>テーブル、椅子の拭き上げ</li>
          <li>冷蔵庫内に放置された食材があれば、付箋を貼って引き継ぎ</li>
          <li>調理器具・食器の確認、足りないものは補充</li>
          <li>ゴミの分別(もえる・もえない・びんの3区分)。山のゴミも引き受けて分別。<strong>ゴミ出しは毎日、最後に帰宅するスタッフが行う</strong></li>
        </ul>

        <h3 className="km-h3">洗濯(Free Laundry)</h3>
        <p className="km-p">洗濯機・乾燥機は宿泊料金込みで使えます(Free Laundry)。長距離を歩くトレッカーには大きな価値です。</p>

        <h4 className="km-h4">業務リネンの洗濯フロー</h4>
        <ol className="km-steps">
          <li>チェックアウト後、使用済みリネンを回収</li>
          <li>シーツ・枕カバー・タオルを分けて洗濯機へ(色物別)</li>
          <li>標準コースで洗濯 → 乾燥機へ</li>
          <li>乾燥後はすぐにたたみ、リネン棚に補充</li>
          <li>1日のリネン使用量を記録(在庫管理用)</li>
        </ol>

        <h4 className="km-h4">ゲストの利用案内</h4>
        <ul className="km-ul">
          <li>洗剤・柔軟剤は備え付けを使用可</li>
          <li>使用後はフィルターのゴミを取る</li>
          <li>洗濯機・乾燥機の利用は<strong>21:00まで</strong>(静粛時間21:00〜6:00と連動)と案内</li>
        </ul>

        <Note label="連泊の場合">
          連泊は基本的に想定していませんが、発生した場合は<strong>チェックイン時に清掃の希望を確認</strong>します(滞在中のベッド周りの清掃・リネン交換の要否)。希望があれば対応、なければ共用部のみ通常清掃。確認した内容はスタッフアプリで共有してください。
        </Note>

        <h3 className="km-h3">15:00前 受付準備チェックリスト</h3>
        <ul className="km-checklist">
          <li>当日チェックイン者の人数分、ベッドメイク完了</li>
          <li>洗面台間に共用タオルと回収ボックスを設置</li>
          <li>共用部の清掃、ゴミ箱が空</li>
          <li>受付の決済端末・タブレットが起動</li>
          <li>ウェルカムドリンク(梅ジュース)とみかんが準備済</li>
          <li>勝手な貼り紙・余計な物がない、余白が保たれている(§04)</li>
        </ul>

      </>
    );

    case "afternoon": return (
      <>
        <h3 className="km-h3">⓪ チェックイン前到着の対応</h3>
        <p className="km-p">古道を歩いて早く到着するゲストもいます。チェックイン時刻(15:00)前でも、温かく受け入れる方針です。玄関は施錠していないため、スタッフ不在の時間帯でもゲストは入れます。</p>
        <ul className="km-ul">
          <li><strong>スタッフ不在時(〜13:00)</strong> — 受付カウンターに常置の案内(日英)が対応役。和室・縁側・ダイニングなどの共用スペースでくつろいでもらってOK</li>
          <li><strong>ドミトリーは清掃前のため、チェックインまで入室不可</strong>。荷物は共用スペースに置いてもらう</li>
          <li>9:00〜13:00 の問い合わせはルッコローが担当</li>
          <li>13:00以降、スタッフ到着後は声をかけ、受付の案内を指して「ごゆっくりお待ちください」とご案内</li>
          <li>正式なチェックイン(名簿記入・会計)とドミトリーへのご案内は15:00から</li>
        </ul>

        <h3 className="km-h3">① 到着(15:00〜) 受付</h3>
        <ol className="km-steps">
          <li><strong>玄関でお迎え</strong> — 笑顔で「いらっしゃいませ / Welcome to KRAFT BASE」</li>
          <li><strong>和室にご案内</strong> — チェックイン作業は和室で座りながら、ゆっくり。立ちっぱなしのカウンター対応ではなく、家に迎え入れるスタイル</li>
          <li><strong>ウェルカムドリンク</strong> — 座った直後に、梅ジュースと山盛りみかんをお出しする。事務手続きの前にまず一服。「手続きされる」のではなく「迎え入れられた」と感じてもらう</li>
          <li><strong>名前確認</strong> — Booking.com / Airbnb / 直予約のどれかを確認</li>
          <li><strong>情報収集</strong> — 健康状態、明日の予定(歩く区間 / 出発時間)を、ドリンクを飲んでもらいながらの会話で自然に聞き取る</li>
          <li><strong>1枚の紙でご案内</strong> — 館内地図と Wi-Fi/主要ルール・緊急連絡先をまとめた施設案内を見せながら、Room / Shower / Kitchen / WiFi の位置を説明</li>
          <li><strong>宿泊者名簿</strong> — 全員分の氏名・住所・連絡先。外国人ゲストはパスポートで顔と名前を確認(撮影・保管はしない)。ドリンクを飲みながらの記入でOK</li>
        </ol>

        <Note label="時間外対応の周知">
          チェックイン時に必ず伝えること:スタッフの在館は<strong>20:00目安まで</strong>。以降の緊急時は、お渡しする施設案内の<strong>緊急連絡先一覧</strong>を参照。個別の連絡は予約サイト(Airbnb / Booking.com 等)のメッセージで受け付けますが、<strong>時間外はすぐに対応できない</strong>ことをあらかじめお伝えしておきます。
        </Note>

        <h3 className="km-h3">② ドミトリー案内</h3>
        <ul className="km-ul">
          <li><strong>ベッド位置</strong> — 上下は年齢と身体状態を考慮(高齢の方は下段、若い方は上段など)</li>
          <li><strong>バックパック棚</strong> — トレッカーの大きな荷物の置き場所</li>
          <li><strong>貴重品ロッカー</strong> — 使用方法、暗証番号の設定</li>
        </ul>

        <h3 className="km-h3">③ シャワー & 洗濯</h3>
        <p className="km-p">このタイミングがゲストの<strong>「旅モード → リラックスモード」</strong>の切り替えです。スムーズに移行できるよう動線を案内。</p>
        <ul className="km-ul">
          <li>シャワー室の使い方、温水の出し方</li>
          <li>洗濯機・乾燥機の使用案内</li>
          <li>洗面台間の共用タオルと、使用後タオル回収ボックスの位置</li>
        </ul>

        <Note label="Cleaning during shift">
          シャワーはゲストが使用するたびに、その都度清掃。水気の拭き上げと髪の毛の除去を毎回。
        </Note>

        <h3 className="km-h3">④ チルタイム(自由時間)</h3>
        <p className="km-p">シャワー後、ゲストは館内・敷地内の<strong>4つのチルスポット</strong>を自由に過ごします。スタッフは過剰に声をかけず、必要なときにそばにいる距離感で。</p>
        <div className="km-table">
          <Row label="ダイニング">他のゲストとの交流・会話</Row>
          <Row label="南側和室">静かな休憩、読書</Row>
          <Row label="縁側">自然を感じる、外の景色を眺める</Row>
          <Row label="カプセル">プライベートな時間、仮眠</Row>
        </div>
        <p className="km-p">さらに、徒歩圏内の<strong>山と川</strong>もチルスポット。希望があれば道案内を。</p>

        <h3 className="km-h3">遅着対応(19:00以降)</h3>
        <div className="km-table">
          <Row label="19:00〜20:00">要事前連絡。モーリーが通常のチェックイン対応を行う</Row>
          <Row label="20:00以降">公式には受け付けない(OTA・予約確認に「最終チェックイン20:00」と明記)。事前連絡があった場合のみ、下記の緊急プロトコルで受け入れる</Row>
        </div>

        <h4 className="km-h4">緊急遅着プロトコル(事前連絡あり限定)</h4>
        <p className="km-p">山道の遅延は不可抗力です。暗い山中で行き場を失うトレッカーを断らないことも、熊野の宿の「安心」のうち。ただし常態化を防ぐため、このプロトコルは表に出さず、連絡があった場合の例外対応とします。</p>
        <ol className="km-steps">
          <li><strong>連絡を受けたら</strong> — 予約サイトのメッセージで(a)パスポート写真の送付(外国人ゲスト)、(b)決済の事前完了(OTA決済済みか確認。現地払い予約はオンライン決済に切替)を依頼</li>
          <li><strong>ベッドの準備</strong> — モーリーは退勤前に、割り当てベッドへ名前カードと宿泊者名簿の用紙をセット</li>
          <li><strong>到着</strong> — 玄関は施錠していないため、ゲストは自分で入って休める</li>
          <li><strong>名簿</strong> — 翌朝、記入済みの名簿を受付の所定ボックスへ残して出発してもらう</li>
          <li><strong>回収</strong> — 翌日13:00、日中スタッフが名簿を回収・確認し、スタッフアプリに記録</li>
        </ol>

        <Alert label="無連絡の深夜到着">
          事前連絡なしの深夜到着があった場合は、翌朝以降に運営へ報告し、名簿・決済の事後処理を行ってください。
        </Alert>

        <Note label="館内販売の案内">
          チェックイン時に「カップ麺・飲み物の販売は20時まで」と一言。夜の「買えない」を防げます(詳細 §02)。
        </Note>

        <Note label="夕食の案内">
          表向きはお弁当は<strong>3日前のオンライン注文制</strong>と案内し、未注文のゲストには「カップ麺(〜20時)か自炊」を案内。ただし<strong>本当に困っているゲストには当日手配も可能</strong>(宿で決済)。最初から見せると常態化するため、最後の手段として裏で対応します。
        </Note>
      </>
    );

    case "evening": return (
      <>
        <Note label="夜シフトの流れ(モーリー)">
          17:00 引き継ぎ → 17〜18:00 お弁当配達 → 夜の交流・館内販売(〜20:00)→ 就寝前に火打石のお見送り → 退勤前クローズ(20:00目安)。<strong>一人で締めるシフト</strong>のため、最後のクローズ手順を確実に。
        </Note>

        <h3 className="km-h3">17:00 モーリーへ引き継ぎ</h3>
        <p className="km-p">17時にモーリーが入り、夜のシフトを担当します(勤務は<strong>20:00目安</strong>まで)。引き継ぎ前に以下を整えてください。</p>
        <ul className="km-checklist">
          <li>当日のチェックイン状況(到着済/未到着の人数)</li>
          <li>お弁当のオンライン注文状況(注文者・個数)</li>
          <li>翌朝セットの確認 — バナナ(宿泊人数+2本)、コーヒー豆の容器残量、みかんの補充</li>
          <li>夜のメッセージボード、火打石の準備状況</li>
          <li>未対応のトラブル・要望</li>
        </ul>

        <h3 className="km-h3">⑤ 夜 交流と夕食</h3>
        <ul className="km-ul">
          <li>ダイニングを中心に、ゲスト同士の交流が生まれる</li>
          <li>夕食(お弁当)、ビールやドリンクの提供</li>
          <li>館内販売(カップ麺・飲み物)の対応 — 販売は20:00目安まで</li>
          <li>スタッフは自然な距離感で見守り、必要なときに会話に入る</li>
          <li>お弁当の配達(17:00〜18:00)— オンライン注文済みのゲストへ引き渡し</li>
          <li>小口エリアの他の注文者は、<strong>KRAFT BASE まで取りに来てもらう</strong>(KRAFT BASE が受け取り拠点)</li>
        </ul>

        <Alert label="要確認(お弁当)">
          通話で確定:肉のおくだからの受け取り方法(モーリーが持参か、店舗で受領か)、各メニュー(焼肉・ヴィーガン・おにぎり)の見分けと渡し方。
        </Alert>

        <Alert label="要確認(BBQ・焚き火)">
          夜に BBQ・焚き火を利用する場合の運用(利用可能時間、後始末、退勤前の消火確認の方法)を通話で決める。<strong>火を残したまま無人にしない</strong>のが大原則。
        </Alert>

        <h3 className="km-h3">⑥ 就寝前 火打石でお見送り</h3>
        <p className="km-p">ゲストがドミトリーに戻り、就寝する時間帯。<strong>スタッフがゲスト一人ひとりに対して「火打石(ひうちいし)」のお見送り</strong>を行います。</p>

        <div className="km-ritual">
          <span className="km-box-label">Ritual</span>
          <div className="km-ritual-title">Hiuchi-ishi<span className="ja">火打石・切り火</span></div>
          <p style={{ margin: "0 0 10px" }}>火打石は、旅立つ人の背後で打って火花を散らすことで、災厄を払い旅の安全を祈る、古くから日本にある<strong>「切り火(きりび)」</strong>の習俗です。武士の出陣、芸者の見送り、漁師の出漁など、人生の節目で大切な人を送り出す所作として受け継がれてきました。</p>
          <p style={{ margin: 0 }}>明日、信仰の道である熊野古道を歩くゲストへの、KRAFT BASE からの祈り。「Unplug to recharge」の体験を締めくくる、最も静かで濃密な瞬間です。</p>
        </div>

        <h4 className="km-h4">基本の進行</h4>
        <ol className="km-steps">
          <li>ゲストがドミトリーへ入る直前のタイミングを見計らう</li>
          <li>「明日のご安全を祈らせてください」と一言(外国人ゲストには英語で2〜3文、§09 参照)</li>
          <li>ゲストの背後に立ち、火打石を打って火花を散らす</li>
          <li>「良い旅を / Have a great hike」と送り出す</li>
        </ol>

        <Note label="心がけ">
          機械的にこなす作業にしない。一人ひとりに向き合い、明日歩く道のりに思いを込めて打つ。短い所作ですが、ゲストの記憶に残る一瞬になります。声のトーンは静かに、敬意を込めて。
        </Note>

        <Alert label="モーリーと決めること(火打石)">
          通話で次を確定し、本文に追記します。
        </Alert>
        <ul className="km-checklist">
          <li>使う石・道具と、その支給・保管場所</li>
          <li>構え方・打ち方(実演して手順を固める)</li>
          <li>声かけの正確なスクリプト(日本語 / 英語)</li>
          <li>火花が出ない・うまくいかない場合の対応</li>
          <li>ゲストが辞退した場合の対応</li>
          <li>就寝時間がバラつくときの実施タイミング(20:00退勤との兼ね合い)</li>
        </ul>

        <h3 className="km-h3">20:00以降 無人時間帯</h3>
        <p className="km-p">モーリーの退勤(20:00目安)以降、KRAFT BASE は無人になります。火打石のお見送りは退勤前に済ませておきます。</p>
        <ul className="km-ul">
          <li>ゲスト対応の方針(緊急連絡先・時間外は即応なし・販売終了)はチェックイン時に周知済み(§07)</li>
          <li>遅着連絡があるゲストがいれば、該当ベッドへ名前カード・名簿用紙のセットを確認(§07)</li>
        </ul>

        <h4 className="km-h4">退勤前クローズ チェックリスト</h4>
        <ul className="km-checklist">
          <li>スタッフアプリに引き継ぎ投稿済み</li>
          <li>火の始末 — キッチン・BBQ・焚き火の消火を確認(火を残して無人にしない)</li>
          <li>窓の戸締まり</li>
          <li>スタッフルームの施錠(宿の玄関は施錠しない)</li>
          <li>共用部の照明を夜モードに</li>
          <li>ゴミの片付け</li>
          <li>翌朝セット完了(バナナ・コーヒー豆・みかん)</li>
          <li>忘れ物・異常がないか最終確認</li>
        </ul>

      </>
    );

    case "foreign": return (
      <>
        <p className="km-p">英語が完璧でなくて大丈夫です。笑顔とジェスチャー、翻訳アプリも使いながら丁寧に対応してください。半数以上が英語またはドイツ語圏のゲストです。</p>
        <Note label="Tip">フレーズ右側の <Volume2 size={12} style={{ verticalAlign: "middle" }} /> をタップすると、英語の発音を再生できます。</Note>
        <Note label="日中スタッフ向け">
          英語に不慣れなスタッフは、このフレーズ集と iPad の翻訳アプリで十分対応できます。無理に話さず、翻訳アプリを開いて画面を見せ合うだけでもOK。専用の台本と翻訳アプリの使い方は別途用意します(確認リスト)。
        </Note>

        {Array.from(new Set(PHRASES.map(p => p.group))).map(group => (
          <div key={group}>
            <div className="km-phrase-group">{group}</div>
            {PHRASES.filter(p => p.group === group).map((p, i) => (
              <Phrase key={i} ja={p.ja} en={p.en} />
            ))}
          </div>
        ))}

        <Note label="For German Guests">
          ドイツ語圏のゲストには「Willkommen / Guten Tag / Vielen Dank / Auf Wiedersehen」だけでも喜ばれます。英語でのコミュニケーションは問題なく通じることがほとんど。送り出しのドイツ語は <em>"Gute Wanderung!"</em>
        </Note>
      </>
    );

    case "family": return (
      <>
        <p className="km-p">夏期(7・8月)を中心に、川遊び目的のファミリーが増えます。家族貸切のスタイルになるため、ドミトリーよりも一軒貸しに近い対応を心がけてください。</p>

        <h3 className="km-h3">寝床の準備(貸切時)</h3>
        <ul className="km-ul">
          <li>布団は使わない。<strong>ドミトリーのマットレスを人数分、和室に並べて</strong>寝床を作る</li>
          <li>セットはスタッフ(日中シフト)が、15:00のチェックインまでに行う</li>
          <li>最大6名(マットレス6枚)</li>
          <li>シーツ類は通常のリネンフローで洗濯(§06)</li>
        </ul>

        <h3 className="km-h3">意識すること</h3>
        <ul className="km-ul">
          <li><strong>安全</strong> — 小さなお子様連れには、川での注意事項(深い場所、増水時の判断)を必ず伝える。<strong>子供用ライフジャケット2着を貸出</strong>。貸出時は「保護者の監視のもとでご利用ください」と必ず一言添える</li>
          <li><strong>清潔</strong> — 水回りの清潔さは家族客が特に気にするポイント</li>
          <li><strong>子供の楽しさ</strong> — 周辺の遊び場(浅瀬、生き物探し)を具体的に案内</li>
          <li><strong>夕食</strong> — 「肉のおくだ」のお弁当を提案。子供向けの食材も用意可能</li>
        </ul>

        <Alert label="Safety">
          川は天候により急に水量が増えることがあります。当日の天気が不安定なときは、川遊びの自粛を促してください。
        </Alert>
      </>
    );

    case "workation": return (
      <>
        <p className="km-p">オフシーズン(6月・12〜2月)はワーケーション利用者が中心。静かに長く滞在して働く人たちで、トレッカーやファミリーとは求めるものが異なります。</p>

        <h3 className="km-h3">意識すること</h3>
        <ul className="km-ul">
          <li><strong>静寂</strong> — BGMは流さず、過度に構わない。仕事に集中できる環境を保つ(三つの柱)</li>
          <li><strong>Wi-Fi</strong> — 安定運用が生命線。不調時は即対応(ルーター再起動 → 改善しなければ運営へ)</li>
          <li><strong>長期滞在の快適さ</strong> — キッチンでの自炊、Free Laundry を活かせるよう最初に案内</li>
          <li><strong>連泊の清掃</strong> — ゲストとコミュニケーションを取り、清掃・リネン交換の要否を決める(§06)</li>
        </ul>

        <Note label="距離感">
          トレッカーの「交流」やファミリーの「賑わい」とは逆に、ワーケーション客はそっとしておかれることを好む傾向。挨拶は欠かさず、でも踏み込みすぎない。これも「安心」の一つの形です。
        </Note>
      </>
    );

    case "emergency": return (
      <>
        <h3 className="km-h3">クレーム対応の基本姿勢</h3>
        <ol className="km-ol">
          <li><strong>まず聞く</strong> — 反論や言い訳をする前に、最後まで聞く</li>
          <li><strong>謝意を示す</strong> — 「ご不便をおかけしました」など、相手の不快感そのものに対して謝罪</li>
          <li><strong>事実を確認する</strong> — 何が、いつ、どう起きたかを冷静に確認</li>
          <li><strong>できる範囲で対応する</strong> — その場で対応できるものは対応(部屋の変更、清掃やり直し等)</li>
          <li><strong>判断に迷ったら必ず運営に連絡</strong> — 一人で抱え込まない。返金・割引等の判断はその場でしない</li>
        </ol>

        <Alert label="Never do this">
          その場で「無料にします」「返金します」と約束しない。SNS/レビューに書かないでくれと頼まない。他のゲストの前で激しく言い合いをしない。
        </Alert>

        <h3 className="km-h3">緊急通報(タップで発信)</h3>
        <div className="km-emergency-grid">
          <a href="tel:110" className="km-emergency-card">
            <div className="km-emergency-card-sub">Police</div>
            <div className="km-emergency-card-name">警察</div>
            <div className="km-emergency-card-num">110</div>
          </a>
          <a href="tel:119" className="km-emergency-card">
            <div className="km-emergency-card-sub">Fire / Ambulance</div>
            <div className="km-emergency-card-name">消防・救急</div>
            <div className="km-emergency-card-num">119</div>
          </a>
          <a href="tel:118" className="km-emergency-card">
            <div className="km-emergency-card-sub">Sea</div>
            <div className="km-emergency-card-name">海上保安庁</div>
            <div className="km-emergency-card-num">118</div>
          </a>
        </div>

        <h3 className="km-h3">火災</h3>
        <ol className="km-ol">
          <li>大声で「火事です!」と他のゲストに知らせる</li>
          <li>119番通報(住所:和歌山県新宮市熊野川町上長井字小和瀬134番地3 / 施設名:KRAFT BASE)</li>
          <li>ゲスト全員を屋外の安全な場所へ避難誘導</li>
          <li>初期消火(消火器の位置は受付・廊下に表示)</li>
          <li>運営責任者に連絡</li>
        </ol>

        <h3 className="km-h3">地震</h3>
        <ol className="km-ol">
          <li>「テーブルの下に / Get under the table」とゲストに伝え、身を守る</li>
          <li>揺れが収まったら火元を確認、ドア・窓を開けて避難経路を確保</li>
          <li>大きな揺れの後は津波警報を確認(熊野川流域は注意)</li>
          <li>避難指示が出た場合は、ゲスト全員を指定避難場所へ誘導</li>
        </ol>

        <h3 className="km-h3">急病・けが</h3>
        <ol className="km-ol">
          <li>意識・呼吸を確認</li>
          <li>重症の場合は119番(住所と症状を伝える)</li>
          <li>軽症の場合は救急箱で応急処置、近隣の医療機関を案内</li>
          <li>運営責任者に連絡</li>
        </ol>

        <h3 className="km-h3">忘れ物</h3>
        <ul className="km-ul">
          <li>スタッフアプリに「日付・発見場所・物品・発見者」を写真付きで記録</li>
          <li>持ち主に連絡を取り、返送方法(着払い / 取りに来る等)を相談して決める</li>
          <li>貴重品(財布・パスポート・スマートフォン等)は警察に届ける</li>
        </ul>

        <h3 className="km-h3">盗難・トラブル</h3>
        <ul className="km-ul">
          <li>ゲスト同士のトラブルは、まず冷静に話を聞く</li>
          <li>盗難の場合は110番、運営責任者にも連絡</li>
          <li>不審者を見かけた場合は無理に対峙せず、警察へ</li>
        </ul>
      </>
    );

    case "report": return (
      <>
        <h3 className="km-h3">引き継ぎ・連絡(スタッフアプリ)</h3>
        <p className="km-p">引き継ぎ・連絡・タスク管理は、専用の<strong>スタッフアプリ</strong>で行います(受付の iPad で管理。紙のノートや Discord は使いません)。ルッコロー(リモート)・日中スタッフ・モーリーの3者が時差勤務でつながる手段です。写真添付(忘れ物・設備の不具合)も活用します。</p>

        <Alert label="開発中">
          スタッフアプリは現在制作中です。完成までの間は、運営が指定する暫定の方法で引き継ぎを行ってください。
        </Alert>

        <h4 className="km-h4">アプリの主な機能(予定)</h4>
        <div className="km-table">
          <Row label="本日のゲスト">当日の予約サマリー(チェックイン・弁当・遅着・特記)。13時出勤後、最初に見る</Row>
          <Row label="引き継ぎ">シフト終わりに記録。日中→17時、モーリー→退勤前。下のテンプレートに沿って</Row>
          <Row label="設備・備品">不具合報告(写真付き)・補充/発注依頼。解決でクローズ</Row>
          <Row label="忘れ物">台帳(写真+日付+場所+発見者)。返送・処分まで追跡</Row>
          <Row label="連絡・相談">迷ったらここ。報告のしすぎで叱られることはない</Row>
          <Row label="タスク">運営からの依頼・確認事項の管理</Row>
        </div>

        <h4 className="km-h4">引き継ぎテンプレート</h4>
        <div className="km-card" style={{ whiteSpace: "pre-line", fontSize: "0.85rem", lineHeight: 1.7 }}>
{`【引き継ぎ】日付・シフト名
■ チェックイン:◯名(到着済◯/未着◯)
■ 弁当:◯個(注文者)
■ 貸切:あり/なし
■ トラブル・要望:
■ 備品・設備:(あれば設備・備品へ)
■ その他:`}
        </div>
        <div className="km-card" style={{ whiteSpace: "pre-line", fontSize: "0.85rem", lineHeight: 1.7 }}>
{`【引き継ぎ】日付・夜(モーリー)
■ 全ゲスト到着:済/遅着対応あり
■ 弁当配達:済
■ 火打石:済(◯名)
■ 翌朝セット:バナナ・豆・みかん 済
■ スタッフルーム施錠:済
■ トラブル:`}
        </div>

        <Alert label="個人情報の扱い">
          ゲストの氏名は「○○様」程度に。<strong>パスポート画像はアプリに投稿しない</strong>(遅着時の本人確認は予約サイトのメッセージ内で完結させる)。
        </Alert>

        <h4 className="km-h4">投稿のルール</h4>
        <ul className="km-ul">
          <li>引き継ぎは毎シフト必ず投稿(口頭で伝えた内容も記録に残す)</li>
          <li>忘れ物・不具合は文章より写真1枚</li>
          <li>緊急(けが・火災・即対応が必要なもの)はアプリではなく電話。アプリは見落としが起こり得る</li>
        </ul>

        <h3 className="km-h3">すぐに運営に連絡すべきこと</h3>
        <ul className="km-ul">
          <li>けが・急病・火災・盗難などの緊急事態</li>
          <li>ゲストからの強いクレーム</li>
          <li>設備の故障(温水が出ない、Wi-Fi 断、鍵のトラブル等)</li>
          <li>判断に迷う事柄(返金・割引の要求、特別な依頼)</li>
        </ul>

        <Note label="Reminder">
          「これくらいで連絡していいのか」と迷ったら、連絡してください。報告のしすぎで叱られることはありません。
        </Note>

        <h3 className="km-h3">連絡先(タップで発信)</h3>
        <a href="tel:08080329762" className="km-emergency-row" style={{ borderColor: "var(--green)" }}>
          <div>
            <div className="km-emergency-label">肉のおくだ</div>
            <div className="km-emergency-sub">運営</div>
          </div>
          <div className="km-emergency-tel" style={{ color: "var(--green)" }}>080-8032-9762</div>
        </a>
        <a href="tel:110" className="km-emergency-row" style={{ borderColor: "var(--green)" }}>
          <div>
            <div className="km-emergency-label">警察</div>
            <div className="km-emergency-sub">Police</div>
          </div>
          <div className="km-emergency-tel" style={{ color: "var(--green)" }}>110</div>
        </a>
        <a href="tel:119" className="km-emergency-row" style={{ borderColor: "var(--orange)" }}>
          <div>
            <div className="km-emergency-label">消防・救急</div>
            <div className="km-emergency-sub">Fire / Ambulance</div>
          </div>
          <div className="km-emergency-tel" style={{ color: "var(--orange)" }}>119</div>
        </a>

        <Note label="連絡先の方針">
          掲示物に電話番号は基本的に載せません。載せる場合は肉のおくだの番号(080-8032-9762)のみ。各種の困りごとは、まず運営(肉のおくだ)へ連絡してください。
        </Note>
      </>
    );

    default:
      return <p>Section not found.</p>;
  }
};

// === MAIN APP ===
export default function StaffManual() {
  const [activeCategory, setActiveCategory] = useState("foundation");
  const [activeSectionId, setActiveSectionId] = useState("welcome");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const scrollRef = useRef(null);

  // Load fonts
  useEffect(() => {
    const preconnect1 = document.createElement("link");
    preconnect1.rel = "preconnect"; preconnect1.href = "https://fonts.googleapis.com";
    const preconnect2 = document.createElement("link");
    preconnect2.rel = "preconnect"; preconnect2.href = "https://fonts.gstatic.com"; preconnect2.crossOrigin = "anonymous";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap";
    document.head.appendChild(preconnect1);
    document.head.appendChild(preconnect2);
    document.head.appendChild(link);
    return () => {
      [preconnect1, preconnect2, link].forEach(el => {
        try { document.head.removeChild(el); } catch (e) {}
      });
    };
  }, []);

  const visibleSections = useMemo(
    () => SECTIONS.filter(s => s.category === activeCategory),
    [activeCategory]
  );
  const activeSection = SECTIONS.find(s => s.id === activeSectionId);

  // Search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    // Sections (by title)
    SECTIONS.forEach(s => {
      if (s.title.toLowerCase().includes(q) || s.sub.toLowerCase().includes(q)) {
        results.push({ type: "section", section: s, snippet: s.title });
      }
    });
    // Phrases
    PHRASES.forEach(p => {
      if (p.ja.toLowerCase().includes(q) || p.en.toLowerCase().includes(q) || p.group.toLowerCase().includes(q)) {
        results.push({ type: "phrase", section: SECTIONS.find(s => s.id === "foreign"), snippet: `${p.ja} / ${p.en}` });
      }
    });
    return results.slice(0, 20);
  }, [searchQuery]);

  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    const first = SECTIONS.find(s => s.category === catId);
    if (first) {
      setActiveSectionId(first.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSectionChange = (id) => {
    setActiveSectionId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const jumpToSection = (s) => {
    setActiveCategory(s.category);
    setActiveSectionId(s.id);
    setSearchOpen(false);
    setSearchQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="km-root">
      <style>{GLOBAL_CSS}</style>

      <div className="km-shell">

        {/* SIDEBAR — desktop only (>=1024px) */}
        <aside className="km-sidebar">
          <div>
            <div className="km-sidebar-brand-title">KRAFT BASE</div>
            <div className="km-sidebar-tagline">Unplug to recharge.</div>
            <div className="km-sidebar-sub">Staff Manual</div>
          </div>

          <button className="km-sidebar-search-btn" style={{ marginBottom: 8 }} onClick={() => setSearchOpen(true)}>
            <Search size={15} />
            <span>セクション・フレーズを検索</span>
          </button>

          <button className="km-sidebar-search-btn" style={{ margin: "0 0 24px" }} onClick={() => setPendingOpen(true)}>
            <ListChecks size={15} />
            <span>確認リスト({PENDING_ITEMS.length})</span>
          </button>

          <nav className="km-sidebar-nav">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} className="km-sidebar-group">
                  <div className="km-sidebar-group-label">
                    <Icon size={11} />
                    <span>{cat.en}</span>
                  </div>
                  {SECTIONS.filter(s => s.category === cat.id).map(s => (
                    <button
                      key={s.id}
                      className={`km-sidebar-link ${activeSectionId === s.id ? "active" : ""}`}
                      onClick={() => jumpToSection(s)}
                    >
                      <span className="km-sidebar-num">{s.num}</span>
                      <span>{s.title}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>

          <div className="km-sidebar-bottom">
            <button className="km-sidebar-emergency-btn" onClick={() => setEmergencyOpen(true)}>
              <Phone size={16} />
              <span>EMERGENCY</span>
            </button>
          </div>
        </aside>

        {/* HEADER — mobile only */}
        <header className="km-header">
          <div>
            <div className="km-brand">KRAFT BASE</div>
            <div className="km-brand-sub">Staff Manual</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="km-icon-btn" onClick={() => setPendingOpen(true)} aria-label="Pending confirmations">
              <ListChecks size={18} />
              {PENDING_ITEMS.length > 0 && <span className="km-badge">{PENDING_ITEMS.length}</span>}
            </button>
            <button className="km-icon-btn" onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search size={18} />
            </button>
          </div>
        </header>

        {/* CHIP BAR */}
        <div className="km-chips">
          {visibleSections.map(s => (
            <button
              key={s.id}
              className={`km-chip ${activeSectionId === s.id ? "active" : ""}`}
              onClick={() => handleSectionChange(s.id)}
            >
              <span className="km-chip-num">{s.num}</span>
              {s.title.split(":")[0]}
            </button>
          ))}
        </div>

        {/* MAIN */}
        <main className="km-main" ref={scrollRef} key={activeSectionId}>
          <div className="km-section-num">{activeSection?.num} — {activeSection?.sub}</div>
          <h2 className="km-h2">{activeSection?.title}</h2>
          <SectionContent id={activeSectionId} />
        </main>

      </div>

      {/* BOTTOM TABS */}
      <nav className="km-tabs">
        <div className="km-tabs-inner">
          {CATEGORIES.map(c => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                className={`km-tab ${activeCategory === c.id ? "active" : ""}`}
                onClick={() => handleCategoryChange(c.id)}
              >
                <Icon size={20} />
                <span className="km-tab-label">{c.ja}</span>
                <span className="km-tab-en">{c.en}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* EMERGENCY FAB */}
      <button className="km-fab" onClick={() => setEmergencyOpen(true)} aria-label="Emergency">
        <Phone size={22} />
      </button>

      {/* EMERGENCY SHEET */}
      {emergencyOpen && (
        <div className="km-overlay" onClick={() => setEmergencyOpen(false)}>
          <div className="km-sheet" onClick={e => e.stopPropagation()}>
            <div className="km-sheet-grip" />
            <div className="km-sheet-title">EMERGENCY</div>
            <div className="km-sheet-sub">タップで発信できます</div>
            {EMERGENCY_NUMBERS.map((e, i) => (
              <a key={i} href={`tel:${e.tel}`} className="km-emergency-row" style={{ borderColor: e.accent }}>
                <div>
                  <div className="km-emergency-label">{e.label}</div>
                  <div className="km-emergency-sub">{e.sub}</div>
                </div>
                <div className="km-emergency-tel" style={{ color: e.accent }}>{e.display}</div>
              </a>
            ))}
            <button
              onClick={() => setEmergencyOpen(false)}
              style={{
                width: "100%", padding: "14px", marginTop: 12,
                background: "transparent", border: "1px solid var(--rule)",
                borderRadius: 12, color: "var(--text-light)",
                fontSize: "0.9rem", fontFamily: "inherit", cursor: "pointer"
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* PENDING SHEET */}
      {pendingOpen && (
        <div className="km-overlay" onClick={() => setPendingOpen(false)}>
          <div className="km-sheet" onClick={e => e.stopPropagation()}>
            <div className="km-sheet-grip" />
            <div className="km-sheet-title">CONFIRMATION LIST</div>
            <div className="km-sheet-sub">確定前・要確認の項目({PENDING_ITEMS.length}件)。確定したら本文に反映し、リストから削除します。</div>
            {PENDING_ITEMS.map(item => {
              const sec = SECTIONS.find(s => s.id === item.sectionId);
              return (
                <div key={item.id} className="km-pending-item">
                  <div className="km-pending-topic">{item.topic}</div>
                  <div className="km-pending-detail">{item.detail}</div>
                  <div className="km-pending-meta">
                    <span className="km-pending-askto">確認先:{item.askTo}</span>
                    {sec && (
                      <button className="km-pending-link" onClick={() => { jumpToSection(sec); setPendingOpen(false); }}>
                        §{sec.num} {sec.title} <ChevronRight size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setPendingOpen(false)}
              style={{
                width: "100%", padding: "14px", marginTop: 12,
                background: "transparent", border: "1px solid var(--rule)",
                borderRadius: 12, color: "var(--text-light)",
                fontSize: "0.9rem", fontFamily: "inherit", cursor: "pointer"
              }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* SEARCH OVERLAY */}
      {searchOpen && (
        <div className="km-overlay search" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
          <div className="km-search-panel" onClick={e => e.stopPropagation()}>
            <div className="km-search-input-wrap">
              <Search size={18} color="var(--text-light)" />
              <input
                className="km-search-input"
                placeholder="セクション・英語フレーズを検索"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-mute)", display: "grid", placeItems: "center" }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="km-search-results">
              {!searchQuery && (
                <div className="km-search-empty">セクション名や英語フレーズ、日本語キーワードで検索できます</div>
              )}
              {searchQuery && searchResults.length === 0 && (
                <div className="km-search-empty">該当する結果がありません</div>
              )}
              {searchResults.map((r, i) => (
                <div key={i} className="km-search-result" onClick={() => jumpToSection(r.section)}>
                  <div className="km-search-result-title">
                    <span className="km-search-result-num">{r.section.num}</span>
                    {r.section.title}
                    <ChevronRight size={14} style={{ marginLeft: "auto", color: "var(--text-mute)" }} />
                  </div>
                  <div className="km-search-result-snippet">{r.snippet}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
