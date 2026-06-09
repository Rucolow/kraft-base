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
        green: { DEFAULT: '#2d4a3e', light: '#3a6355' },
        wood: { DEFAULT: '#8b6914', light: '#c4a35a', pale: '#e8d5a3' },
        orange: { DEFAULT: '#c8703c', light: '#d4894f' },
        cream: { DEFAULT: '#f5f0e6', dark: '#ede4d0' },
        ink: { DEFAULT: '#2a2a25', light: '#6b6555' },
        paper: '#fdfbf6',
      },
      fontFamily: {
        heading: [fontFamilies.heading],
        sans: [fontFamilies.body],
      },
      boxShadow: {
        kb: '0 2px 8px rgba(42, 42, 37, 0.08)',
        'kb-lg': '0 8px 24px rgba(42, 42, 37, 0.12)',
      },
      borderRadius: {
        kb: '12px',
        'kb-lg': '20px',
      },
    },
  },
} satisfies Partial<Config>;

export default brandPreset;
