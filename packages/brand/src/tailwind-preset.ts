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
        orange: { DEFAULT: '#c8703c', light: '#d4894f', deep: '#a8542a' },
        cream: { DEFAULT: '#f5f0e6', dark: '#ede4d0' },
        ink: { DEFAULT: '#2a2a25', light: '#6b6555', mute: '#9a9587' },
        paper: '#fdfbf6',
        line: 'rgba(42, 42, 37, 0.09)',
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
