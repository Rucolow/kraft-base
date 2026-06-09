/**
 * KRAFT BASE — fonts.
 * 見出し: Cormorant Garamond / 本文: Zen Kaku Gothic New。
 */
export const fontFamilies = {
  heading: '"Cormorant Garamond", serif',
  body: '"Zen Kaku Gothic New", sans-serif',
} as const;

export type FontRole = keyof typeof fontFamilies;

/** `<link rel="stylesheet">` で読み込む Google Fonts の URL。 */
export const googleFontsHref =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap';

/** プリコネクト先（パフォーマンス用）。 */
export const googleFontsPreconnect = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
] as const;
