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
        // Logo palette: deep teal field + warm amber mark.
        green: { DEFAULT: '#0f3d36', light: '#2d4a3e', deep: '#0a2c27' },
        wood: { DEFAULT: '#9a7416', light: '#c4a35a', pale: '#e8d5a3' },
        orange: { DEFAULT: '#e08a2e', light: '#ed9d4f', deep: '#b56a1c' },
        cream: { DEFAULT: '#f4eedf', dark: '#e9dec7' },
        ink: { DEFAULT: '#26261f', light: '#615b4c', mute: '#938d7d' },
        paper: '#fcf9f1',
        line: 'rgba(15, 61, 54, 0.12)',
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
