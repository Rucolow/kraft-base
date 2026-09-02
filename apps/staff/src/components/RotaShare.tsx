import { Link2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../lib/supabase/client';

// R9-b: owner-only panel with the ONE house-wide shift-page link. The token is
// fetched through the owner-gated rota_link RPC (never synced to devices).
// Re-issuing invalidates the link for everyone — the confirm says so.
export function RotaShare() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    if (!supabase) {
      setError('本番環境（ログイン時）でのみ利用できます。');
      return;
    }
    const { data, error: rpcError } = await supabase.rpc('rota_link');
    if (rpcError) {
      setError(`取得できませんでした: ${rpcError.message}`);
      return;
    }
    setError(null);
    setToken(typeof data === 'string' ? data : null);
  }

  const link = token ? `${window.location.origin}/rota/?t=${token}` : null;

  async function copy() {
    if (!link) {
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('このリンクをコピーしてください', link);
    }
  }

  async function reset() {
    if (!supabase) {
      return;
    }
    if (
      !window.confirm(
        'シフト表のリンクを再発行しますか？\n今のリンクは全員分が使えなくなります。新しいリンクを全員に送り直してください。',
      )
    ) {
      return;
    }
    const { data, error: rpcError } = await supabase.rpc('rota_reset');
    if (rpcError) {
      setError(`再発行できませんでした: ${rpcError.message}`);
      return;
    }
    setError(null);
    setToken(typeof data === 'string' ? data : null);
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) {
            load();
          }
        }}
        className="flex min-h-[40px] items-center gap-1.5 rounded-full border border-line px-4 font-bold text-[0.8rem] text-ink-light"
      >
        <Link2 size={14} /> スタッフにシフト表を共有
      </button>
      {open ? (
        <div className="mt-2 rounded-kb border border-line p-3">
          <p className="mb-2 text-[0.76rem] text-ink-light">
            宿で1本のリンクです。LINE のグループなどで送り、スマホの「ホーム画面に追加」を
            してもらうと、以後はアイコンから最新のシフト表が見られます（ログイン不要）。
            ページ下のスタッフ一覧をタップすると、自分の分だけを表示できます。
            リンクが外部に漏れたら「再発行」で旧リンクを無効化できます（全員に再配布）。
          </p>
          {error ? <p className="mb-2 text-[0.78rem] text-orange-deep">{error}</p> : null}
          {link ? (
            <div className="flex items-center gap-2 rounded-[11px] border border-line bg-paper px-3 py-2">
              <span className="flex-1 truncate text-[0.72rem] text-ink-light">{link}</span>
              <button
                type="button"
                onClick={copy}
                className="min-h-[40px] shrink-0 rounded-full bg-orange px-3.5 font-bold text-[0.78rem] text-onaccent"
              >
                {copied ? 'コピーしました' : 'リンクをコピー'}
              </button>
              <button
                type="button"
                aria-label="リンクを再発行"
                onClick={reset}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line text-ink-mute"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
