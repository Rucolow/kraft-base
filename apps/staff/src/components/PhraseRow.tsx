import { Volume2 } from 'lucide-react';

function speak(text: string, lang: string): void {
  if (!('speechSynthesis' in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

const BCP47: Record<string, string> = {
  en: 'en-US',
  de: 'de-DE',
  it: 'it-IT',
  fr: 'fr-FR',
  es: 'es-ES',
  ja: 'ja-JP',
};

export function PhraseRow({ label, text, lang }: { label: string; text: string; lang: string }) {
  return (
    <div className="mb-2 flex items-center gap-2.5 rounded-[12px] border border-line bg-paper px-3 py-2.5">
      <div className="flex-1">
        <div className="text-[0.68rem] tracking-wide text-ink-mute">{label}</div>
        <div className="font-medium text-[0.98rem]">{text}</div>
      </div>
      <button
        type="button"
        aria-label="発音"
        onClick={() => speak(text, BCP47[lang] ?? 'en-US')}
        className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border border-line bg-cream text-orange active:bg-orange active:text-paper"
      >
        <Volume2 size={16} />
      </button>
    </div>
  );
}
