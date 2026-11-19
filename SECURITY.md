# 安全政策

## 回報問題

發現安全問題（例如可以改別人的棋局、讀到不該讀的資料、讓網站執行外來的程式），
請用 GitHub 的 [Report a vulnerability](https://github.com/ToruSmith/ChessTorusGamets/security/advisories/new)
私下回報，不要開公開的 Issue。如果那個頁面打不開，請開一則 Issue，只寫「有安全問題想私下回報」，不要寫細節。
一般錯誤與建議請用 [Issues](https://github.com/ToruSmith/ChessTorusGamets/issues)。

## 安全設計摘要

這是純靜態網站，沒有自己的伺服器；線上對戰用 Firebase Realtime Database 與匿名登入，
所以設計時假設**用戶端不可信**，保護全部靠 `database.rules.json`：

| 威脅                       | 防護                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------ |
| 寫入「我贏了」             | 資料庫沒有勝負欄位，雙方都從棋步與事件重演得出結果                                   |
| 替對方下棋、改已下的棋步   | 規則依 `n` 的奇偶判斷輪到誰；棋步只能附加，`moves/<i>` 與 `n` 同一次寫入             |
| 偽造時間、拖延對手的時間   | 開房、開局與每手時間戳都必須等於伺服器時間（`now`）                                  |
| 替對方認輸、提和、聲明和棋 | 事件只能附加，而且只能以自己的顏色寫入；有效性由重演判斷                             |
| 搶座位、改房間設定         | 座位只能由本人寫入一次；房間建立後不能覆寫，設定欄位與數值範圍都有白名單             |
| 整包讀走所有房間           | 房間清單只能用大廳查詢讀取（依 `createdAt`，最多 30 筆，見 `docs/decisions.md` D36） |
| 對局中偷用引擎             | 網站在線上對局結束前不提供分析與提示（這是約定，無法阻止玩家另外開其他軟體）         |
| 被其他網站嵌入（點擊劫持） | `public/_headers` 的 `frame-ancestors 'self'`                                        |

`tests/online/rules.test.ts` 用 `tests/helpers/rules-db.ts` 載入真的規則檔，每一次寫入與大廳查詢都經過規則求值。
每月的巡檢（`.github/workflows/health.yml`）會對正式網站匿名登入、讀取大廳，並檢查相依套件的安全公告。

## 已知限制

- 匿名登入不能防止有人大量建立房間。目前的用量遠低於 Firebase 免費額度；如果遇到濫用，
  可以在 Firebase 啟用 App Check。房間不會自動清理（D22），需要時可以在 Firebase Console 手動刪除舊房間。
- Firebase 網頁設定（含 `apiKey`）本來就會出現在每個訪客的瀏覽器裡，不是密鑰。
