// Supabase auth errors surface as raw English strings ("Token has expired or is
// invalid", "Email rate limit exceeded"). Shown verbatim to a Japanese-speaking
// innkeeper they read as "the app is broken". Map the known ones to plain
// Japanese with an actionable next step; keep the original only for the unknown
// tail so support still has something to go on.

export interface FriendlyAuthError {
  message: string;
  // Only set for unmapped errors — shown small, as a support breadcrumb.
  original: string | null;
}

export function mapAuthError(raw: string | null | undefined): FriendlyAuthError | null {
  if (!raw) {
    return null;
  }
  const lower = raw.toLowerCase();

  // Wrong/old/expired code. The most common real cause here is requesting a new
  // code (which invalidates the previous one), so say that explicitly.
  if (
    lower.includes('expired') ||
    lower.includes('otp_expired') ||
    lower.includes('invalid') ||
    lower.includes('incorrect')
  ) {
    return {
      message:
        'コードが正しくないか、期限が切れています。最後に届いたメールのコードを入力してください。（新しいコードを送ると、前のコードは使えなくなります）',
      original: null,
    };
  }

  // Too many sends in a short window.
  if (
    lower.includes('rate limit') ||
    lower.includes('over_email_send') ||
    lower.includes('too many')
  ) {
    return {
      message: '送信回数が多すぎます。数分待ってから、もう一度お試しください。',
      original: null,
    };
  }

  // No network / fetch failure.
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('load failed')
  ) {
    return {
      message: 'ネットワークに接続できませんでした。通信環境を確認して、もう一度お試しください。',
      original: null,
    };
  }

  return { message: 'ログインに失敗しました。もう一度お試しください。', original: raw };
}
