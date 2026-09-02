import { brandPreset } from '@kraft-base/brand/tailwind-preset';
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './rota.html', './src/**/*.{ts,tsx}'],
  presets: [brandPreset],
} satisfies Config;
