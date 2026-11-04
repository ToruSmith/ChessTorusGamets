# online

線上對戰的房間邏輯。只認得 `RoomBackend` 介面（`types.ts`），不知道 Firebase 的存在。

- `session.ts`：開房、入座、走棋、事件、再戰、大廳。每次寫入都必須通過 `database.rules.json`。
- `room.ts`：把資料庫內容解析成 `Room`，並轉成 `core` 的 `MatchRecord` 讓 `replayMatch` 判定。
- `firebase/backend.ts`：唯一 import `firebase` 的檔案，進入線上對戰時才動態載入。
- `local-backend.ts`：e2e 版用的同一瀏覽器後端（`localStorage` + `storage` 事件）。
- `tree.ts`：JSON 樹的讀寫工具，本機後端與測試用的規則模擬器共用。

只依賴 `core/`。詳見 `docs/architecture.md` 的「線上對戰」。
