# 第三方授權

本專案以 [GPL-3.0](LICENSE) 授權釋出。以下列出使用到的第三方套件與素材。
每個里程碑新增依賴時，都要同步更新這份清單（見 `CLAUDE.md`）。

## 打包進網站的套件

這些程式碼會出現在 `dist/` 裡，隨網站一起發佈。

| 套件        | 版本   | 授權 | 來源                                |
| ----------- | ------ | ---- | ----------------------------------- |
| `react`     | 19.3.1 | MIT  | <https://github.com/facebook/react> |
| `react-dom` | 19.3.1 | MIT  | <https://github.com/facebook/react> |
| `scheduler` | 0.28.0 | MIT  | <https://github.com/facebook/react> |

`tailwindcss` 產生的 CSS（含 preflight 基礎樣式）也會進入 `dist/`，授權為 MIT。

## 開發與建置工具

只在開發、測試或建置時使用，不會發佈到網站。

| 套件                   | 版本    | 授權       |
| ---------------------- | ------- | ---------- |
| `vite`                 | 8.3.5   | MIT        |
| `@vitejs/plugin-react` | 6.2.1   | MIT        |
| `tailwindcss`          | 4.3.4   | MIT        |
| `@tailwindcss/vite`    | 4.3.4   | MIT        |
| `typescript`           | 7.0.2   | Apache-2.0 |
| `prettier`             | 3.9.10  | MIT        |
| `@playwright/test`     | 1.63.0  | Apache-2.0 |
| `@types/react`         | 19.3.0  | MIT        |
| `@types/react-dom`     | 19.3.0  | MIT        |
| `@types/node`          | 22.20.5 | MIT        |

## 預定在後續里程碑加入

| 套件                                             | 里程碑 | 授權                    | 用途                                   |
| ------------------------------------------------ | ------ | ----------------------- | -------------------------------------- |
| `chess.js`                                       | M1     | BSD-2-Clause            | 規則核心（只在 `src/core` 使用）       |
| `firebase`（JS SDK）                             | M3     | Apache-2.0              | 線上對戰：Realtime Database 匿名登入   |
| Stockfish.js（lite 單執行緒版）                  | M4     | GPL-3.0                 | 電腦對手與賽後分析，在 Web Worker 執行 |
| Lichess 開局資料（`lichess-org/chess-openings`） | M5     | CC0-1.0（加入時再確認） | 備用開局                               |

## 素材

棋盤、棋子、圖示與動畫都是本專案自製的 SVG，沒有使用外部棋子圖片或字型檔。
