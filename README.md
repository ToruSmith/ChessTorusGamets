# 西洋棋 ChessTorusGamets

在瀏覽器裡下西洋棋的網頁遊戲：雙人同機、線上對戰、電腦對手與賽後分析。
規則與引擎都在瀏覽器裡執行，線上對戰使用 Firebase，不需要自建伺服器。

> 目前進度：**M4 電腦對手與賽後分析**完成。PWA、英文介面完善、備用開局與正式部署在 M5。

## 規劃中的功能

- **雙人同機**（M2，已完成）：一台裝置輪流下。點選或拖曳走子、升變選子、悔棋（不計時時）、翻轉棋盤、
  提和、認輸、聲明和棋，可選時制，重新整理後接著下。
- **線上對戰**（M3，已完成）：開房間分享連結或房號，或從大廳加入公開房間；匿名登入、免註冊。
  可以觀戰、提和、聲明和棋、認輸，對局結束後可以再來一局（交換先後手）。
- **電腦對手**（M4，已完成）：八個難度，可選執白、執黑或隨機，可以要求提示、悔棋。
- **賽後分析**（M4，已完成）：任何模式下完的對局都能分析；勝率走勢圖、評估條、每手的好壞判斷
  （不精確 ?!、錯著 ?、大錯 ??）、引擎推薦手的箭頭，可以用方向鍵逐手瀏覽。
- 引擎是 Stockfish.js lite 單執行緒版，在 Web Worker 中執行；線上對局進行中不提供任何引擎協助。
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

| 指令                   | 用途                                        |
| ---------------------- | ------------------------------------------- |
| `npm run dev`          | 開發伺服器                                  |
| `npm run build`        | 正式版建置到 `dist/`                        |
| `npm run preview`      | 預覽 `dist/`                                |
| `npm run typecheck`    | TypeScript 型別檢查                         |
| `npm run format`       | Prettier 排版                               |
| `npm run format:check` | 檢查排版                                    |
| `npm test`             | 單元測試（node:test）                       |
| `npm run test:e2e`     | 端對端測試（Playwright），會自動建置 e2e 版 |
| `npm run check`        | 型別、排版、單元測試、建置一次跑完          |

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

## 設定 Firebase（線上對戰）

沒有設定時，其他模式照常運作，線上對戰會顯示「尚未設定」。這個專案要用**自己專屬的** Firebase 專案。

1. 在 [Firebase Console](https://console.firebase.google.com/) 建立專案。
2. **Authentication → 登入方式**：啟用「匿名」。
3. **Realtime Database**：建立資料庫（地區任選），記下資料庫網址。
4. 部署資料庫規則（`firebase.json` 已指向 `database.rules.json`）：

   ```bash
   npx firebase-tools deploy --only database --project <你的專案 ID>
   ```

   也可以把 `database.rules.json` 的內容貼到 Console 的「規則」分頁後發布。

5. **專案設定 → 一般 → 你的應用程式**：新增網頁應用程式，把設定值填進環境變數（名稱見 `.env.example`）：

   | 變數                         | 對應的設定值  |
   | ---------------------------- | ------------- |
   | `VITE_FIREBASE_API_KEY`      | `apiKey`      |
   | `VITE_FIREBASE_AUTH_DOMAIN`  | `authDomain`  |
   | `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
   | `VITE_FIREBASE_PROJECT_ID`   | `projectId`   |
   | `VITE_FIREBASE_APP_ID`       | `appId`       |

   本機開發時複製成 `.env.local`（已被 `.gitignore` 排除）；部署時設定在 Cloudflare Pages 的環境變數（M5）。

這些值會出現在每個訪客的瀏覽器裡，本身不是祕密，資料安全由 `database.rules.json` 把關；但仍然不要提交到儲存庫。

## 授權

[GPL-3.0](LICENSE)。第三方套件與素材的授權見 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
