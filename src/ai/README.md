# ai

電腦對手與分析。Stockfish.js lite 單執行緒版在 Web Worker 中執行，透過 UCI 文字行溝通。

- `uci.ts`：解析引擎輸出。
- `engine.ts`：`UciEngine`，依序處理搜尋請求；`UciTransport` 隔開 Worker 與 Node。
- `worker-transport.ts`：瀏覽器用的 Worker 傳輸。
- `levels.ts`：八個難度。
- `analysis.ts`：分數、勝率與好壞手判斷（純函式）。

只依賴 `core/`；只有這一層可以碰 `stockfish`。
