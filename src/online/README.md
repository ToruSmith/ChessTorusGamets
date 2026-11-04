# online

線上對戰（M3）。房間邏輯只認得 `RoomBackend` 介面；Firebase 實作放在 `online/firebase/`，
整個專案只有那個子目錄可以 import `firebase`。只依賴 `core/`。
