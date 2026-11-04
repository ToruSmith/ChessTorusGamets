# CLAUDE.md

給在這個儲存庫工作的 Claude（與人類維護者）的規則。架構細節見 `docs/architecture.md`。

## 專案

獨立的西洋棋網頁遊戲：雙人同機、線上對戰、電腦對手、賽後分析。

- **獨立專案**：不與其他棋類專案共用程式碼、Firebase 專案或部署設定。
- `ToruSmith/ShogiGamets` 只能**唯讀參考**它的分層與線上設計；不得複製將棋規則、程式碼或素材，也不得修改該專案。

## 技術

React 19、Vite、TypeScript（strict）、Tailwind CSS 4、chess.js、Stockfish.js（lite 單執行緒）、
Firebase Realtime Database + 匿名登入、Cloudflare Pages。Node 22（`.nvmrc`）。

## 指令

| 指令                                      | 用途                                               |
| ----------------------------------------- | -------------------------------------------------- |
| `npm run dev`                             | 開發伺服器                                         |
| `npm run typecheck`                       | 型別檢查（`src/` 與測試／設定檔分兩個專案）        |
| `npm run format`                          | Prettier 排版                                      |
| `npm run format:check`                    | 檢查排版（CI 使用）                                |
| `npm test`                                | 單元測試（node:test，Node 原生執行 TS）            |
| `npm run test:e2e`                        | Playwright 端對端測試（自動建置 e2e 版並啟動預覽） |
| `npm run build`                           | 正式版建置到 `dist/`                               |
| `npm run check`                           | typecheck + format:check + test + build            |
| `npm run smoke -- <網址>`                 | 部署後驗收（加 `--online` 會連 Firebase，只讀）    |
| `npm run generate:icons`                  | 由 `public/icons/icon.svg` 產生 PNG 圖示           |
| `npm run generate:openings -- <tsv 目錄>` | 由 Lichess `chess-openings` 產生開局資料           |

開 PR 前必須 `npm run check` 與 `npm run test:e2e` 全部通過。

## 分層規則（由 `tests/architecture.test.ts` 強制）

```
app / views / components / board  ──▶  state  ──▶  ai, online  ──▶  core
```

- `chess.js` **只能**在 `src/core/` 使用（實際上只有 `core/game.ts`）。UI 只能用 `core/` 輸出的本專案型別與函式。
- 其他層 import `core/` 時一律經過 `src/core/index.ts`。
- `firebase` 只能在 `src/online/firebase/` 使用；其他地方透過 `RoomBackend` 介面。
- `stockfish` 只能在 `src/ai/` 使用，並在 Web Worker 中執行。
- `core/`、`ai/`、`online/`、`state/` 不可依賴 React、DOM 或儲存。
- 畫面（`views/`、`components/`、`board/`）不可直接 import `ai/` 或 `online/`，一律經過 `state/`。
- 要改層級規則時，同時改 `tests/helpers/import-rules.ts`、`docs/architecture.md` 與本檔。

## 程式慣例

- 相對 import **一律寫副檔名**（`./game.ts`、`./Board.tsx`），Node 才能直接跑測試。
- 只用可被擦除的 TS 語法（`erasableSyntaxOnly`）：不用 `enum`、`namespace`、建構子參數屬性；型別 import 用 `import type`。
- 介面文字一律走 `src/i18n/`，不在元件裡寫死字串。新增 key 時 `zh-TW.ts` 與 `en.ts` 都要加。預設語言是繁體中文。
- 棋盤、棋子、圖示與動畫都用自製 SVG，**不使用外部棋子圖片**。
- 純邏輯寫在 `core/` 並用 node:test 測；互動流程用 Playwright 測。
- 排版交給 Prettier，不手動調整。

## 線上對戰的不變式（M3）

- 棋步只能附加：`moves/<i>` 與 `n` 同一次寫入，不可覆寫；每手帶伺服器時間戳（規則要求 `t === now`）。
- 勝負與超時**不寫入資料庫**，由棋步與時間戳重演得出。
- 認輸、提和、接受和棋、聲明和棋以**附加事件**記錄，有效性由重演判斷。
- **線上對局進行中，不可使用引擎分析或提示**；由 `state/` 把關（`OnlineSnapshot.analysisAllowed`），對局結束後才開放分析。
- 改 `database.rules.json` 時，同時在 `tests/online/rules.test.ts` 加上正反兩面的測試。
- e2e 版（`npm run build:e2e`，`.env.e2e`）用 `online/local-backend.ts` 取代 Firebase；它不執行規則。

## 引擎（M4）

- Stockfish.js lite 單執行緒版（`stockfish` 套件，版本見 `package.json`）。`vite.config.ts` 的外掛把它複製到 `engine/`；
  升級版本時同時改外掛裡的檔名、`src/config.ts` 的網址與 `engine/SOURCE.txt` 的內容。
- 引擎分析只能從 `MatchSnapshot.analysis`（對局結束才有）開始；線上另外看 `analysisAllowed`。提示只在對電腦模式。
- 單元測試用 `tests/helpers/node-engine.ts` 在 Node 跑真的引擎。

## PWA 與部署（M5）

- `sw.js` 由 `vite.config.ts` 在建置時產生，預先快取所有輸出；新增需要離線使用的檔案時，放在 `public/` 或由建置輸出即可。
- Cloudflare Pages 的快取規則在 `public/_headers`。部署設定與驗收步驟見 README。
- 開局資料（`src/core/data/openings.json`）是產生的檔案，不要手動編輯。

## 勝負與和棋（依 FIDE 正式比賽規定，詳見 `docs/architecture.md`）

- **自動結束**：將死、逼和、死局面、五次重複局面（9.6.1）、75 回合規則（9.6.2）、超時（6.9）。
  超時時，若對手不可能將死超時方，判和。
- **需要聲明**：三次重複局面（9.2）與 50 回合規則（9.3）。由輪到走棋的一方聲明，也可以「走這步並聲明和棋」。
  條件不成立就不結束，對局繼續。
- 提和送出後不可撤回；對手走下一步就視為拒絕。
- 這些規則在所有模式（雙人同機、線上、對電腦）都一樣，由 `core/` 統一判定。

## 密鑰與設定

- 不提交任何密鑰或 `.env.local`。`.env.example` 只列變數名稱（`VITE_FIREBASE_*`），不填值。
- Firebase 網頁設定雖然會出現在瀏覽器裡，仍只透過環境變數注入，不寫進程式碼。

## 授權

- 本專案為 GPL-3.0（`LICENSE`）。
- 新增或升級依賴、加入素材時，同步更新 `THIRD_PARTY_LICENSES.md`。

## 里程碑與工作流程

| 里程碑 | 內容                                  |
| ------ | ------------------------------------- |
| M0     | 專案骨架與 CLAUDE.md                  |
| M1     | 規則核心                              |
| M2     | 雙人同機                              |
| M3     | 線上對戰                              |
| M4     | 電腦對手與賽後分析                    |
| M5     | PWA、i18n、Lichess 備用開局與完成部署 |

- 每個里程碑獨立一個 PR，**等使用者確認後才進行下一個**。
- 指令沒寫到的部分採用合理預設值；有多個方案時選風險最低、最容易日後修改的。重要決定記在 `docs/decisions.md`。
- 只有需要付費、密鑰、登入使用者帳號、在 Firebase／Cloudflare／GitHub 手動操作、刪除資料或難以復原的動作、
  改變授權或既定需求時，才停下來詢問；需要手動操作時，先做完其他部分，再一次列出所有待辦。
- PR 說明要列出計畫、假設、做了什麼，以及 typecheck、format、test、build、e2e 的結果。

## 不做的事

註冊登入、開局統計、Cloudflare Worker、Render 或任何自建伺服器。
