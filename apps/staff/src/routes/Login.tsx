import { useEffect, useState } from 'react';
import { PrimaryButton, TextField } from '../components/ui';
import { useAuth } from '../lib/auth';
import { type FriendlyAuthError, mapAuthError } from '../lib/authErrors';

const RESEND_COOLDOWN = 60;

export function Login() {
  const { signInWithEmail, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<FriendlyAuthError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Count the resend cooldown down to zero, one second at a time.
  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send() {
    if (!email.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await signInWithEmail(email.trim());
    setBusy(false);
    if (result.error) {
      setError(mapAuthError(result.error));
      return;
    }
    setSent(true);
    setCooldown(RESEND_COOLDOWN);
  }

  async function resend() {
    if (cooldown > 0 || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const result = await signInWithEmail(email.trim());
    setBusy(false);
    if (result.error) {
      setError(mapAuthError(result.error));
      return;
    }
    setNotice('新しいコードを送りました。以前のコードは使えません。');
    setCode('');
    setCooldown(RESEND_COOLDOWN);
  }

  async function verify() {
    if (code.trim().length < 6) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await verifyCode(email.trim(), code.trim());
    setBusy(false);
    if (result.error) {
      setError(mapAuthError(result.error));
    }
    // On success the session updates via onAuthStateChange and the app routes on.
  }

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col justify-center bg-paper px-6 pb-8 md:max-w-xl">
      <div className="font-heading text-[1.5rem] text-orange tracking-[0.22em]">KRAFT BASE</div>
      <div className="mt-0.5 mb-8 font-heading text-[0.9rem] text-orange italic">
        Unplug to recharge.
      </div>
      {sent ? (
        <>
          <h1 className="mb-2 font-bold text-[1.1rem]">確認コードを入力</h1>
          <p className="mb-4 text-[0.86rem] text-ink-light">
            <span className="text-ink">{email}</span> に届いたコードを入力してください。
          </p>
          <TextField
            label="確認コード"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="コードを入力"
          />
          {notice ? <p className="mb-2 text-[0.8rem] text-orange-light">{notice}</p> : null}
          {error ? (
            <div className="mb-2">
              <p className="text-[0.8rem] text-orange-deep">{error.message}</p>
              {error.original ? (
                <p className="mt-0.5 text-[0.68rem] text-ink-mute">{error.original}</p>
              ) : null}
            </div>
          ) : null}
          <PrimaryButton onClick={verify} disabled={busy || code.length < 6}>
            ログイン
          </PrimaryButton>
          <p className="mt-3 text-[0.78rem] text-ink-light">
            最新のメールのコードだけが使えます。メールに番号が無くリンクが届いた場合は、そのリンクを開いてもログインできます。
          </p>
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={resend}
              disabled={busy || cooldown > 0}
              className="text-[0.8rem] text-orange underline disabled:text-ink-mute disabled:no-underline"
            >
              {cooldown > 0 ? `コードを再送（${cooldown}秒後）` : 'コードを再送する'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode('');
                setError(null);
                setNotice(null);
                setCooldown(0);
              }}
              className="text-[0.8rem] text-ink-mute underline"
            >
              メールアドレスを入力し直す
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="mb-4 font-bold text-[1.1rem]">ログイン</h1>
          <TextField
            label="メールアドレス"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          {error ? (
            <div className="mb-2">
              <p className="text-[0.8rem] text-orange-deep">{error.message}</p>
              {error.original ? (
                <p className="mt-0.5 text-[0.68rem] text-ink-mute">{error.original}</p>
              ) : null}
            </div>
          ) : null}
          <PrimaryButton onClick={send} disabled={busy || !email.trim()}>
            確認コードを送る
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
