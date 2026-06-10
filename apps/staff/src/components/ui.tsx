import { ChevronLeft } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Screen({ children }: { children: ReactNode }) {
  return <div className="px-4 pt-4 pb-8 md:px-8 md:pt-6 md:pb-12">{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 mb-2 px-0.5 font-heading text-[0.7rem] uppercase tracking-[0.22em] text-ink-mute first:mt-0">
      {children}
    </div>
  );
}

export function Card({
  children,
  onClick,
  primary,
  muted,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  muted?: boolean;
}) {
  const base = 'mb-3 rounded-kb border border-line p-4 text-left shadow-kb-sm transition-transform';
  const tone = muted ? 'bg-cream' : 'bg-paper';
  const accent = primary ? 'border-t-[3px] border-t-orange shadow-kb' : '';
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`block w-full ${base} ${tone} ${accent} active:scale-[0.985]`}
      >
        {children}
      </button>
    );
  }
  return <div className={`${base} ${tone} ${accent}`}>{children}</div>;
}

export function CardHead({
  icon,
  title,
  trailing,
  tone = 'green',
}: {
  icon: ReactNode;
  title: string;
  trailing?: ReactNode;
  tone?: 'green' | 'orange' | 'wood';
}) {
  const bubble = {
    green: 'bg-green/10 text-green',
    orange: 'bg-orange/10 text-orange',
    wood: 'bg-wood/10 text-wood',
  }[tone];
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <span
        className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] ${bubble}`}
      >
        {icon}
      </span>
      <span className="font-bold text-[0.95rem] text-green">{title}</span>
      {trailing ? <span className="ml-auto">{trailing}</span> : null}
    </div>
  );
}

export type BadgeTone = 'ok' | 'warn' | 'wood' | 'neutral';

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  const styles: Record<BadgeTone, string> = {
    ok: 'bg-green/10 text-green',
    warn: 'bg-orange/15 text-orange-deep',
    wood: 'bg-wood/10 text-wood',
    neutral: 'bg-cream-dark text-ink-light',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-[3px] font-bold text-[0.7rem] ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export function NeedsInputBadge() {
  return <Badge tone="warn">要確認</Badge>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="px-1 py-3 text-[0.84rem] text-ink-mute">{children}</div>;
}

export function BackButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1.5 inline-flex items-center gap-0.5 py-0.5 font-sans text-[0.86rem] text-green"
    >
      <ChevronLeft size={18} /> {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-green font-bold text-cream text-[0.95rem] tracking-wide shadow-kb active:translate-y-px disabled:opacity-50 ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="min-h-[44px] w-full rounded-[13px] border border-line bg-transparent font-sans text-[0.88rem] text-ink-light"
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="mb-3 block">
      {label ? <span className="mb-1 block text-[0.78rem] text-ink-light">{label}</span> : null}
      <input
        {...rest}
        className="min-h-[44px] w-full rounded-[11px] border border-line bg-cream px-3 py-2.5 text-base text-ink outline-none focus:border-green-light"
      />
    </label>
  );
}

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <button
        type="button"
        aria-label="閉じる"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div className="relative max-h-[86%] w-full overflow-y-auto rounded-t-[24px] bg-paper px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3.5 h-1 w-9 rounded-sm bg-line" />
        <div className="text-center font-heading text-[1.1rem] tracking-wide text-green">
          {title}
        </div>
        {subtitle ? (
          <div className="mb-4 text-center text-[0.76rem] text-ink-mute">{subtitle}</div>
        ) : (
          <div className="mb-2" />
        )}
        {children}
      </div>
    </div>
  );
}
