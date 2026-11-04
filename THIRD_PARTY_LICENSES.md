# 第三方授權

本專案以 [GPL-3.0](LICENSE) 授權釋出。以下列出使用到的第三方套件與素材。
每個里程碑新增依賴時，都要同步更新這份清單（見 `CLAUDE.md`）。

## 打包進網站的套件

這些程式碼會出現在 `dist/` 裡，隨網站一起發佈。

| 套件        | 版本   | 授權         | 來源                                 |
| ----------- | ------ | ------------ | ------------------------------------ |
| `react`     | 19.3.1 | MIT          | <https://github.com/facebook/react>  |
| `react-dom` | 19.3.1 | MIT          | <https://github.com/facebook/react>  |
| `scheduler` | 0.28.0 | MIT          | <https://github.com/facebook/react>  |
| `chess.js`  | 1.4.0  | BSD-2-Clause | <https://github.com/jhlywa/chess.js> |

`chess.js` 只在 `src/core/game.ts` 使用；畫面從 M2 開始使用 `core/` 後，它就會被打包進網站。

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
| `firebase`（JS SDK）                             | M3     | Apache-2.0              | 線上對戰：Realtime Database 匿名登入   |
| Stockfish.js（lite 單執行緒版）                  | M4     | GPL-3.0                 | 電腦對手與賽後分析，在 Web Worker 執行 |
| Lichess 開局資料（`lichess-org/chess-openings`） | M5     | CC0-1.0（加入時再確認） | 備用開局                               |

## 素材

棋盤、棋子、圖示與動畫都是本專案自製的 SVG，沒有使用外部棋子圖片或字型檔。

## 授權全文

打包進網站的套件要求隨附以下授權聲明。

### chess.js（BSD-2-Clause）

```text
Copyright (c) 2025, Jeff Hlywa (jhlywa@gmail.com)
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
POSSIBILITY OF SUCH DAMAGE.
```

### react、react-dom、scheduler（MIT）

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
