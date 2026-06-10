import { useState } from 'react';
import { PrimaryButton, TextField } from '../components/ui';
import { useAuth } from '../lib/auth';

export function Login() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!email.trim()) {
      return;
    }
    const result = await signInWithEmail(email.trim());
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  }

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] md:max-w-xl flex-col justify-center bg-paper px-6 pb-8">
      <div className="font-heading text-[1.5rem] tracking-[0.22em] text-orange">KRAFT BASE</div>
      <div className="mt-0.5 mb-8 font-heading text-[0.9rem] text-orange italic">
        Unplug to recharge.
      </div>
      {sent ? (
        <p className="text-[0.9rem] text-ink-light">
          ログイン用のリンクを {email} に送りました。メールのリンクを開いてください。
        </p>
      ) : (
        <>
          <h1 className="mb-4 font-bold text-[1.1rem]">ログイン</h1>
          <TextField
            label="メールアドレス"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          {error ? <p className="mb-2 text-[0.8rem] text-orange-deep">{error}</p> : null}
          <PrimaryButton onClick={submit}>マジックリンクを送る</PrimaryButton>
        </>
      )}
    </div>
  );
}
