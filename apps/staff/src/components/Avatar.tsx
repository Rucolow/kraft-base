import type { StaffRow } from '../lib/powersync/schema';

export function Avatar({ staff, size = 30 }: { staff: StaffRow | null; size?: number }) {
  const initial = staff?.name?.slice(0, 1) ?? '?';
  const background = staff?.accent ?? '#1f564b';
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold"
      style={{ width: size, height: size, background, color: '#f8f3e6', fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}
