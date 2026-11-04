# state

把 `core/`（之後還有 `ai/`、`online/`）組成「一盤棋」的控制器。不依賴 React、DOM 或儲存。

- `local-match.ts`：雙人同機。保存紀錄，每次變動都用 `core` 的 `replayMatch` 重演。
- `snapshot.ts`：畫面用的不可變快照。
- `store.ts`：可觀察值，畫面透過 `components/useStore.ts` 訂閱。
- `presets.ts`：時制選項（翻譯 key 為 `time.<id>`）。
