import type { StaffRow } from '../lib/powersync/schema';

export function Avatar({ staff, size = 30 }: { staff: StaffRow | null; size?: number }) {
  const initial = staff?.name?.slice(0, 1) ?? '?';
  const background = staff?.accent ?? '#3a6355';
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-paper"
      style={{ width: size, height: size, background, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}
