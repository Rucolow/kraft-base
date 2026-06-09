import { brandPreset } from '@kraft-base/brand/tailwind-preset';
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  presets: [brandPreset],
} satisfies Config;
