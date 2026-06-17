import { useState } from 'react';
import { PrimaryButton, TextField } from '../components/ui';
import { useAuth } from '../lib/auth';

export function Login() {
  const { signInWithEmail, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!email.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await signInWithEmail(email.trim());
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
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
      setError(result.error);
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
          {error ? <p className="mb-2 text-[0.8rem] text-orange-deep">{error}</p> : null}
          <PrimaryButton onClick={verify} disabled={busy || code.length < 6}>
            ログイン
          </PrimaryButton>
          <p className="mt-3 text-[0.78rem] text-ink-light">
            メールに番号が無く、リンクが届いた場合は、そのリンクを開いてもログインできます。
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setCode('');
              setError(null);
            }}
            className="mt-3 text-[0.8rem] text-ink-mute underline"
          >
            メールアドレスを入力し直す
          </button>
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
          {error ? <p className="mb-2 text-[0.8rem] text-orange-deep">{error}</p> : null}
          <PrimaryButton onClick={send} disabled={busy || !email.trim()}>
            確認コードを送る
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
