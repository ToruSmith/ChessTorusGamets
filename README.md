# 西洋棋 ChessTorusGamets

在瀏覽器裡下西洋棋的網頁遊戲：雙人同機、線上對戰、電腦對手與賽後分析。
規則與引擎都在瀏覽器裡執行，線上對戰使用 Firebase，不需要自建伺服器。

> 目前進度：**M1 規則核心**完成（`src/core`）。畫面還不能下棋，從 M2 開始。

## 規劃中的功能

- **雙人同機**（M2）：一台裝置輪流下，可以悔棋、翻轉棋盤。
- **線上對戰**（M3）：開房間分享代碼，匿名登入、免註冊。
- **電腦對手與賽後分析**（M4）：Stockfish.js 在 Web Worker 中執行。
- **PWA、英文介面、備用開局與正式部署**（M5）。

勝負與和棋依 FIDE 正式比賽規定：

- 自動結束：將死、逼和、死局面、五次重複局面、75 回合規則、超時。
- 需要聲明：三次重複局面與 50 回合規則，由輪到走棋的一方聲明和棋。

## 快速開始

需要 Node.js 22.18 以上。

```bash
npm install
```

```bash
npm run dev
```

開發伺服器預設在 <http://localhost:5173/>。

## 指令

| 指令                   | 用途                                 |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | 開發伺服器                           |
| `npm run build`        | 正式版建置到 `dist/`                 |
| `npm run preview`      | 預覽 `dist/`                         |
| `npm run typecheck`    | TypeScript 型別檢查                  |
| `npm run format`       | Prettier 排版                        |
| `npm run format:check` | 檢查排版                             |
| `npm test`             | 單元測試（node:test）                |
| `npm run test:e2e`     | 端對端測試（Playwright），會自動建置 |
| `npm run check`        | 型別、排版、單元測試、建置一次跑完   |

第一次跑端對端測試前要安裝瀏覽器：

```bash
npx playwright install chromium
```

## 技術

- React 19、Vite、TypeScript、Tailwind CSS 4。
- 規則：chess.js，只在 `src/core/` 裡使用，畫面不直接依賴它。
- 棋盤、棋子與動畫都是自製 SVG。
- 線上對戰：Firebase Realtime Database + 匿名登入，透過 `RoomBackend` 介面隔離。
- 引擎：Stockfish.js lite 單執行緒版，在 Web Worker 中執行。
- 測試：node:test、Playwright；GitHub Actions 在每次推送與 PR 時執行。

架構與設計見 [docs/architecture.md](docs/architecture.md)，重要決定與理由見 [docs/decisions.md](docs/decisions.md)，開發規則見 [CLAUDE.md](CLAUDE.md)。

## 設定 Firebase（M3 之後才需要）

把 `.env.example` 複製成 `.env.local`，填入本專案 Firebase 網頁應用程式的設定值。
`.env.local` 已列在 `.gitignore`，不要提交。

## 授權

[GPL-3.0](LICENSE)。第三方套件與素材的授權見 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
