import { Link2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../lib/supabase/client';

interface LinkRow {
  staff_id: string;
  name: string;
  token: string;
}

// R9: owner-only panel listing each staff member's shift-page link. Tokens are
// fetched through the owner-gated rota_links RPC (never synced to devices).
export function RotaShare() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    if (!supabase) {
      setError('本番環境（ログイン時）でのみ利用できます。');
      return;
    }
    const { data, error: rpcError } = await supabase.rpc('rota_links');
    if (rpcError) {
      setError(`取得できませんでした: ${rpcError.message}`);
      return;
    }
    setError(null);
    setRows((data ?? []) as LinkRow[]);
  }

  const linkFor = (token: string) => `${window.location.origin}/rota/?t=${token}`;

  async function copy(row: LinkRow) {
    try {
      await navigator.clipboard.writeText(linkFor(row.token));
      setCopied(row.staff_id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt('このリンクをコピーしてください', linkFor(row.token));
    }
  }

  async function reset(row: LinkRow) {
    if (!supabase) {
      return;
    }
    if (
      !window.confirm(
        `${row.name} のリンクを再発行しますか？\n今のリンクは使えなくなります（本人に新しいリンクを送り直してください）。`,
      )
    ) {
      return;
    }
    const { error: rpcError } = await supabase.rpc('rota_reset_token', { p_staff: row.staff_id });
    if (rpcError) {
      setError(`再発行できませんでした: ${rpcError.message}`);
      return;
    }
    await load();
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
            各スタッフ専用のリンクです。LINE で送り、スマホの「ホーム画面に追加」をしてもらうと、
            以後はアイコンから最新のシフト表が見られます（ログイン不要）。
            リンクが漏れたら「再発行」で旧リンクを無効化できます。
          </p>
          {error ? <p className="mb-2 text-[0.78rem] text-orange-deep">{error}</p> : null}
          {rows.map((row) => (
            <div
              key={row.staff_id}
              className="mb-2 flex items-center gap-2 rounded-[11px] border border-line bg-paper px-3 py-2"
            >
              <span className="flex-1 font-bold text-[0.9rem]">{row.name}</span>
              <button
                type="button"
                onClick={() => copy(row)}
                className="min-h-[40px] rounded-full bg-orange px-3.5 font-bold text-[0.78rem] text-onaccent"
              >
                {copied === row.staff_id ? 'コピーしました' : 'リンクをコピー'}
              </button>
              <button
                type="button"
                aria-label={`${row.name} のリンクを再発行`}
                onClick={() => reset(row)}
                className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink-mute"
              >
                <RefreshCw size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
