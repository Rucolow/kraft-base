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
        // Tokens resolve from CSS variables (packages/brand/src/tokens.css) so the
        // theme can switch at runtime via the `.theme-light` class.
        green: {
          DEFAULT: 'rgb(var(--kb-green) / <alpha-value>)',
          light: 'rgb(var(--kb-green-light) / <alpha-value>)',
          deep: 'rgb(var(--kb-green-deep) / <alpha-value>)',
        },
        wood: {
          DEFAULT: 'rgb(var(--kb-wood) / <alpha-value>)',
          light: 'rgb(var(--kb-wood-light) / <alpha-value>)',
          pale: 'rgb(var(--kb-wood-pale) / <alpha-value>)',
        },
        orange: {
          DEFAULT: 'rgb(var(--kb-orange) / <alpha-value>)',
          light: 'rgb(var(--kb-orange-light) / <alpha-value>)',
          deep: 'rgb(var(--kb-orange-deep) / <alpha-value>)',
        },
        cream: {
          DEFAULT: 'rgb(var(--kb-cream) / <alpha-value>)',
          dark: 'rgb(var(--kb-cream-dark) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--kb-ink) / <alpha-value>)',
          light: 'rgb(var(--kb-ink-light) / <alpha-value>)',
          mute: 'rgb(var(--kb-ink-mute) / <alpha-value>)',
        },
        paper: 'rgb(var(--kb-paper) / <alpha-value>)',
        ondark: 'rgb(var(--kb-on-dark) / <alpha-value>)',
        line: 'var(--kb-line)',
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
