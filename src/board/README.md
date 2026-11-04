# board

自製 SVG 棋盤、棋子與動畫。不使用外部棋子圖片。

- `ChessBoard.tsx`：棋盤元件（點選、拖曳、升變選子、提示、將軍標示）。
- `pieces.tsx`：原創棋子造型。
- `identity.ts`：替棋子決定穩定 id，讓移動有動畫（純函式，有單元測試）。
- `geometry.ts`：格子與座標換算。

可以使用 `core/` 的型別（經 `core/index.ts`），但不可 import `chess.js`。
