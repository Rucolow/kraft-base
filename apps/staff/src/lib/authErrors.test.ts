import { describe, expect, it } from 'vitest';
import { mapAuthError } from './authErrors';

describe('mapAuthError', () => {
  it('returns null for empty input', () => {
    expect(mapAuthError(null)).toBeNull();
    expect(mapAuthError(undefined)).toBeNull();
    expect(mapAuthError('')).toBeNull();
  });

  it('maps expired/invalid OTP to the "use the latest code" guidance, hiding the raw text', () => {
    const result = mapAuthError('Token has expired or is invalid');
    expect(result?.original).toBeNull();
    expect(result?.message).toContain('最後に届いたメールのコード');
    expect(result?.message).toContain('新しいコードを送ると');
  });

  it('maps the otp_expired error code too', () => {
    expect(mapAuthError('otp_expired')?.message).toContain('期限が切れています');
  });

  it('maps rate-limit errors', () => {
    expect(mapAuthError('Email rate limit exceeded')?.message).toContain('送信回数が多すぎます');
    expect(mapAuthError('over_email_send_rate_limit')?.message).toContain('数分待って');
  });

  it('maps network failures', () => {
    expect(mapAuthError('Failed to fetch')?.message).toContain('ネットワーク');
    expect(mapAuthError('Load failed')?.message).toContain('ネットワーク');
  });

  it('falls back to a generic message but keeps the original for unknown errors', () => {
    const result = mapAuthError('Some brand new server error 500');
    expect(result?.message).toBe('ログインに失敗しました。もう一度お試しください。');
    expect(result?.original).toBe('Some brand new server error 500');
  });
});
