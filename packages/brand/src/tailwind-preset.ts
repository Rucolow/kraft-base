import type { Config } from 'tailwindcss';
import { fontFamilies } from './fonts';

/**
 * KRAFT BASE — Tailwind preset.
 * 各アプリの tailwind.config で `presets: [brandPreset]` として読み込む。
 * 値は packages/brand/src/tokens.css と対応。
 */
export const brandPreset = {
  theme: {
    extend: {
      colors: {
        // Dark logo world: deep teal surfaces, amber accent, light ink.
        green: { DEFAULT: '#15463e', light: '#1f564b', deep: '#0a2a25' },
        wood: { DEFAULT: '#c9a24e', light: '#ddbe7e', pale: '#e8d5a3' },
        orange: { DEFAULT: '#eb9a3c', light: '#f4b366', deep: '#c8772a' },
        cream: { DEFAULT: '#0c332d', dark: '#17443c' },
        ink: { DEFAULT: '#f3eddd', light: '#ccc6b4', mute: '#8f998f' },
        paper: '#11403a',
        line: 'rgba(243, 237, 221, 0.13)',
      },
      fontFamily: {
        heading: [fontFamilies.heading],
        sans: [fontFamilies.body],
      },
      boxShadow: {
        'kb-sm': '0 1px 2px rgba(42, 42, 37, 0.05)',
        kb: '0 6px 22px rgba(42, 42, 37, 0.10)',
        'kb-lg': '0 14px 40px rgba(42, 42, 37, 0.16)',
      },
      borderRadius: {
        kb: '12px',
        'kb-lg': '20px',
      },
    },
  },
} satisfies Partial<Config>;

export default brandPreset;
