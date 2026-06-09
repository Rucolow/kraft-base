# KRAFT BASE

ゲストハウス運営のためのモノレポ。スタッフ向け PWA（`apps/staff`）と公開サイト（`apps/site`）を
共通のブランド資産（`packages/brand`）と TypeScript 設定（`packages/tsconfig`）の上に構築する。

## 構成

```
kraft-base/
├─ apps/
│  ├─ staff/      # スタッフ向け PWA (Vite + React + TS + Tailwind + vite-plugin-pwa)
│  └─ site/       # 公開サイト（現行の静的サイト。kraft-base.vercel.app）
├─ packages/
│  ├─ brand/      # デザイントークン・Tailwind プリセット・フォント
│  └─ tsconfig/   # 共有 tsconfig（base / react）
└─ docs/
   └─ build-plan.md   # 制作工程
```

## 必要環境

- Node.js >= 22
- pnpm 10（`corepack enable` で利用可）

## セットアップ

```bash
pnpm install
```

## よく使うコマンド（ルートで実行）

| コマンド | 内容 |
| --- | --- |
| `pnpm build` | 全ワークスペースをビルド（turbo） |
| `pnpm dev` | 各アプリの開発サーバを起動 |
| `pnpm typecheck` | 型チェック |
| `pnpm test` | テスト |
| `pnpm lint` | Biome による lint/format チェック |
| `pnpm format` | Biome による自動整形 |

## デプロイ

- `apps/site`: Vercel の既存 `kraft-base` プロジェクト。Root Directory を `apps/site` に設定。
- `apps/staff`: 別 Vercel プロジェクト。Root Directory を `apps/staff` に設定。

詳細な制作工程は [`docs/build-plan.md`](docs/build-plan.md) を参照。
