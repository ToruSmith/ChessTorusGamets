# core

規則核心。純 TypeScript，不碰 DOM、網路、儲存或 React，Node 與瀏覽器都能跑。

- 其他層只能從 `index.ts` import。
- 只有 `game.ts` 使用 `chess.js`；其他檔案與對外 API 只用 `types.ts` 的本專案型別。
- 勝負與和棋依 FIDE《西洋棋規則》，細節與條號見 `docs/architecture.md`。
