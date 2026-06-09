# CLAUDE.md — KRAFT BASE リポジトリ規約

## 構成

pnpm workspaces + turbo のモノレポ。

- `apps/staff` — スタッフ向け PWA（Vite + React + TS + Tailwind + vite-plugin-pwa）。
- `apps/site` — 公開サイト（現行の静的サイト、`kraft-base.vercel.app`）。
- `packages/brand` — デザイントークン（`tokens.css`）、Tailwind プリセット、フォント定義。
- `packages/tsconfig` — 共有 tsconfig（`base.json` / `react.json`）。
- `docs/` — リポ横断のドキュメント（制作工程など）。

## ツール

- パッケージ管理: **pnpm 10**（`npm`/`yarn` は使わない）。
- タスクランナー: **turbo**（`pnpm <task>` はルートから turbo 経由で実行）。
- Lint / Format: **Biome**（`pnpm lint` / `pnpm format`）。ESLint/Prettier は使わない。
- 型: TypeScript strict。各パッケージの tsconfig は `packages/tsconfig` を継承。

## ブランド

- 配色（`packages/brand/src/tokens.css` が正本）:
  - teal/green `#2D4A3E`、orange `#C8703C`、cream `#F5F0E6`、wood `#8B6914` 系。
- フォント: 見出し **Cormorant Garamond**、本文 **Zen Kaku Gothic New**。
- 色やフォントはハードコードせず、`packages/brand` のトークン/プリセット経由で参照する。

## 開発の流れ

1. 変更後は `pnpm typecheck` と `pnpm lint` を通す。
2. 節目ごとに build/lint を通してコミットする。
3. アプリ固有の手順は各 `apps/*/README` または `apps/*/docs` を参照。

## 制作工程

[`docs/build-plan.md`](docs/build-plan.md) のフェーズを上から順に進める。
