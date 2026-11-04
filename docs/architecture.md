# 架構說明

寫給之後要維護這個專案的人，以及在這裡工作的 AI 助手。目前是 M0（骨架），
下面描述的是整體設計；各層的實作在對應的里程碑完成時補上，這份文件也會一起更新。

## 分層與依賴方向

```
app（App.tsx、main.tsx）
  └─ views/ ─ components/ ─ board/   ← 畫面，只有這幾層用 React
        │
        ▼
      state/  ──────────────┐        ← 一盤棋的控制器（不依賴 React）
        │         │         │
        ▼         ▼         ▼
       ai/     online/      │
        │         │         │
        └────▶  core/  ◀────┘        ← 規則核心，唯一使用 chess.js 的地方

i18n/：字典與翻譯函式，各層畫面都可以用；本身不依賴其他層。
```

| 層            | 可以依賴                                            | 外部套件限制                                   |
| ------------- | --------------------------------------------------- | ---------------------------------------------- |
| `core/`       | （無）                                              | 唯一可以 import `chess.js`；不可用 React       |
| `ai/`         | `core/`                                             | 唯一可以 import `stockfish`；不可用 React      |
| `online/`     | `core/`                                             | 只有 `online/firebase/` 可以 import `firebase` |
| `state/`      | `core/`、`ai/`、`online/`                           | 不可用 React                                   |
| `i18n/`       | （無）                                              | `I18nProvider.tsx` 可以用 React                |
| `board/`      | `core/`、`i18n/`、`components/`                     |                                                |
| `components/` | `core/`、`state/`、`i18n/`、`board/`                |                                                |
| `views/`      | `core/`、`state/`、`i18n/`、`board/`、`components/` |                                                |
| app           | 以上畫面層與 `core/`、`state/`、`i18n/`             |                                                |

這張表由 `tests/helpers/import-rules.ts` 以資料的形式定義，`tests/architecture.test.ts` 每次 `npm test`
都會掃過 `src/` 檢查。要改規則時，表、程式與本文件三者一起改。
另外，其他層 import `core/` 時只能經過 `src/core/index.ts`。

重點：

- **畫面不認得 chess.js**。棋盤收到的是 `core/` 輸出的本專案型別（局面、合法手、棋步），
  將來換掉規則函式庫時，只動 `core/`。
- **畫面不直接碰引擎或網路**。`views/` 不能 import `ai/` 或 `online/`，一律經過 `state/`。
  這也是「線上對局中禁止引擎」能在一個地方把關的原因（見下文）。
- **Firebase 被 `RoomBackend` 介面隔離**。房間邏輯只認介面；Firebase、e2e 用的本機模擬後端、
  單元測試用的規則模擬器都實作同一個介面。

## 一盤棋 = 起始局面 + 一串棋步

棋局狀態完全由「起始 FEN + 棋步序列（UCI 寫法，例如 `e2e4`、`e7e8q`）」決定。
悔棋、復盤、斷線重連、計時、判定勝負都是重演同一串棋步，不另外儲存可能不一致的衍生狀態。

### `core/` 的公開 API（M1）

其他層一律從 `src/core/index.ts` import，不可直接 import `core/` 裡的個別檔案（架構測試會檢查）。

| 檔案          | 內容                                                                                  |
| ------------- | ------------------------------------------------------------------------------------- |
| `types.ts`    | `Color`、`Piece`、`Square`、`Move`、`MoveInput` 等本專案型別，`STARTING_FEN`          |
| `square.ts`   | `SQUARES`（a8 → h1，畫棋盤的順序）、座標換算、格子顏色                                |
| `uci.ts`      | UCI 字串（`e2e4`、`e7e8q`）與 `MoveInput` 互轉                                        |
| `game.ts`     | `Game` 類別：唯一使用 chess.js 的檔案。走子、悔棋、合法手、局面鍵、自動結局、和棋聲明 |
| `material.ts` | 子力不足的死局面、超時時對手能否將死（6.9）                                           |
| `outcome.ts`  | `GameResult`、`ResultReason`、`DrawClaimReason`                                       |
| `clock.ts`    | 由時間戳計算的棋鐘（費雪制加秒）                                                      |
| `match.ts`    | `replayMatch`：棋步＋時間戳＋附加事件 → 唯一的結果、棋鐘與未失效的提和                |

- `Game` 是可變物件（`play`、`undo`），`clone()` 會複製。要給畫面的不可變快照由 `state/` 產生（M2）。
- 走子只接受**完全相符**的合法手：升變一定要指定棋子，非升變的棋步帶升變字母也算不合法。
  這樣線上資料裡的 `e2e4q` 之類的寫法會被判為不合法，而不是被默默接受。
- FEN 除了 chess.js 的格式檢查，還會檢查：王車易位權與王、車位置相符，第一或第八橫列沒有兵，
  不該走的一方沒有被將軍。
- `replayMatch` 同時用於雙人同機（本機時間）與線上（伺服器時間），兩種模式的判定完全一樣。

## 勝負與和棋（依 FIDE 西洋棋規則）

依國際棋聯（FIDE）《西洋棋規則》（Laws of Chess）。條號以 2023 年起施行的版本為準。
重點是區分「**自動結束**」與「**需要聲明**」。

### 自動結束（不需要任何人操作）

| 情況         | 結果             | 條文  | 備註                                                              |
| ------------ | ---------------- | ----- | ----------------------------------------------------------------- |
| 將死         | 將死方勝         | 5.1.1 |                                                                   |
| 逼和         | 和棋             | 5.2.1 |                                                                   |
| 死局面       | 和棋             | 5.2.2 | 雙方都無法以任何合法著法將死對方。M1 先偵測子力不足的情況，見下方 |
| 五次重複局面 | 和棋             | 9.6.1 | 同一局面出現第五次                                                |
| 75 回合規則  | 和棋             | 9.6.2 | 雙方各走 75 步沒有吃子也沒有兵的移動；最後一步若將死，以將死為準  |
| 超時         | 超時方負，或和棋 | 6.9   | 對手無法以任何合法著法將死超時方時，判和                          |

### 需要聲明（輪到的一方按「聲明和棋」）

| 情況         | 條文 | 可以聲明的時機                                                   |
| ------------ | ---- | ---------------------------------------------------------------- |
| 三次重複局面 | 9.2  | 目前局面已出現三次，或自己即將走的一步會造成第三次出現           |
| 50 回合規則  | 9.3  | 雙方各已走 50 步沒有吃子也沒有兵的移動，或自己即將走的一步會達成 |

- 聲明只能由**輪到走棋的一方**提出（9.2.1、9.3.1）。「即將走的一步會達成」時，介面提供「走這步並聲明和棋」，
  棋步與聲明一起送出。
- 條件不成立的聲明不會結束對局，對局繼續。
- 對手的條件成立但沒有聲明時，對局照常進行，直到五次重複或 75 回合時自動和棋。

### 判定細節

- **相同局面**（9.2.2）：輪到同一方、同樣的棋子在同樣的格子上，而且可能的走法相同。也就是王車易位權與
  吃過路兵的可能性都要相同；只有真的能吃過路兵時，過路兵格才算進局面。M1 會用測試確認 chess.js 的局面鍵符合這一點。
- **死局面**：M1 先偵測子力不足：王對王、王加一枚輕子對王、雙方只剩同色格主教。
  像兵完全互鎖這類其他死局面，第一版不偵測，對局會繼續到 75 回合或五次重複時自動和棋。
- **超時**（6.9）：超時方判負。例外是對手只剩國王，或對手的子力在任何走法下都不可能將死超時方，這時判和。
  M1 用保守的判斷：只有確定不可能將死時才判和。
- **提和**（9.1.2）：提和送出後不能撤回，對手可以接受或拒絕。對手走下一步就視為拒絕，提和失效。
- **認輸**（5.1.2）：任何時候都可以認輸，對局立即結束。

## 線上對戰（M3）

使用本專案專屬的 Firebase Realtime Database 與匿名登入，不自建伺服器。

```
views/OnlineLobbyView、OnlineRoomView
        │  useStore()
        ▼
state/OnlineService（連線、大廳、開房）、OnlineMatch（一個房間：重演、動作、再戰）
        │
        ▼
online/session.ts（房間操作）──▶ RoomBackend 介面
                                   ├─ online/firebase/backend.ts  正式版（唯一 import firebase 的檔案）
                                   ├─ online/local-backend.ts     e2e 版（同一瀏覽器的分頁之間）
                                   └─ tests/helpers/fake-server.ts 單元測試（規則模擬器）
```

- `RoomBackend` 只有六個方法：`uid`、`serverNow`、`get`、`watch`、`update`（多路徑原子更新）、
  `newestRooms`。伺服器時間用 `SERVER_TIME` 占位，由各後端換成伺服器時鐘（Firebase 是 `serverTimestamp()`）。
- Firebase SDK 只在進入線上對戰時才動態載入；沒有設定 `VITE_FIREBASE_*` 時，線上對戰顯示「尚未設定」，
  其他模式不受影響。
- 伺服器時間：Firebase 用 `.info/serverTimeOffset` 校正，雙方都用伺服器時間判斷超時。

### 資料模型

```
rooms/<房號>/                     房號：6 碼，不含 0/O、1/I/L
  createdAt      伺服器時間
  createdBy      建立者 uid
  config         { initialMs（0 = 不計時）, incrementMs, public, creatorColor }   ← 建立後不可改
  players/w, b   uid                                                            ← 各只能寫一次
  startedAt      第二位玩家入座時的伺服器時間（與入座同一次寫入）
  n              目前手數
  moves/<i>      { i, m: 'e2e4', t: 伺服器時間 }        ← 只能附加，與 n 同一次寫入
  events/<k>     { type, by: 'w'|'b', ply, t }           ← 只能附加
  rematch/w, b   true                                    ← 各自表態要再來一局
  next           再戰房號（寫一次，與新房間同一次寫入）
  prev           這是哪個房間的再戰
```

`events` 的 key 以手數開頭（`0012-…`），排序後就是發生順序；重演時仍依 `ply` 與 `t` 處理。

### 不變式

1. **棋步只能附加**。`moves/<i>` 必須和 `n = i + 1` 同一次多路徑更新寫入；規則禁止覆寫已存在的棋步，
   並依 `n` 的奇偶確認輪到寫入者。對局開始（`startedAt` 存在）前不能走棋。
2. **每手帶伺服器時間戳**。規則要求 `t === now`，客戶端無法偽造時間。
3. **勝負不寫入資料庫**。將死、逼和、死局面、五次重複、75 回合、超時，雙方都從棋步與時間戳重演得出，
   結論必然一致。沒有任何欄位可以寫「我贏了」（未列出的欄位一律被規則拒絕）。
4. **超時由重演得出**。超過時限之後才寫入的棋步，重演時視為不存在。該方超時負，但符合 6.9 例外時判和。
5. **認輸、提和、接受和棋、聲明和棋是附加事件**。`type` 是 `resign`、`draw-offer`、`draw-accept`、
   `draw-claim` 其中之一。事件同樣只能附加，並帶伺服器時間與當下手數（規則要求 `ply === n`）；
   `by` 必須是寫入者自己的座位。事件是否有效由重演判斷，例如：
   - 接受和棋時，對方是否真的有尚未失效的提和。
   - 聲明和棋時，三次重複或 50 回合的條件是否成立，而且是由輪到的一方提出。
   - 「走這步並聲明和棋」時，棋步與 `draw-claim` 必須在同一次多路徑更新中寫入。
6. **規則擋不到的壞資料由重演判負**。例如不合法的棋步：重演到那一手時，寫入的一方判負。

### 規則與測試

- 規則在 `database.rules.json`（`firebase.json` 指向它，部署時用）。
- `tests/helpers/rules-db.ts` 是規則模擬器：真的載入 `database.rules.json`，依 Firebase 文件的語意逐條求值。
  `.write` 往下繼承；`.validate` 檢查寫入節點、其下所有節點與上層節點；`$變數` 萬用字元；運算式出錯視為 false。
  `tests/helpers/fake-server.ts` 用它組成多個客戶端與可控時鐘的假伺服器。
- `tests/online/rules.test.ts` 直接測規則，包括各種作弊情境：
  - 改寫棋步、輪不到時走棋、偽造時間
  - 替別人入座、寫入勝負
  - 替對方認輸、重複連結再戰房間
- `tests/online/online-match.test.ts` 讓兩個客戶端透過假伺服器完整對局：
  - 大廳、入座、觀戰
  - 將死、認輸、提和、兩種聲明和棋
  - 伺服器時間超時、再戰
- 模擬器不是 Firebase 官方引擎。大改規則後，請到 Firebase Console 的 Rules Playground 再確認一次。

### 開房、入座、觀戰、再戰

- 開房：建立者坐在選定的顏色（可選隨機），可選擇是否公開在大廳。
- 入座：第二位玩家一次寫入自己的座位與 `startedAt`；之後進入房間的人都是觀戰者（只能看）。
- 大廳：讀最新 30 個房間，只列出公開、只有一人、還沒開始，而且不是自己開的房間。
- 再戰：雙方都表態後，**上一盤的白方**建立新房間（顏色互換、不公開），並在同一次寫入裡設定舊房間的 `next`。
  雙方看到 `next` 就前往新房間，另一方因為是 `prev` 房間的玩家而自動入座。

### e2e 測試用的本機後端

`npm run test:e2e` 使用 `vite build --mode e2e`（`.env.e2e` 設定 `VITE_ONLINE_BACKEND=local`），輸出到 `dist-e2e/`。
本機後端把資料放在 `localStorage`，用 `storage` 事件通知其他分頁，讓兩個分頁可以對局。
BroadcastChannel 的訊息可能比 `localStorage` 同步得早，造成讀到舊資料，所以不用它。
它不執行資料庫規則（規則由單元測試涵蓋），也是 `online/` 中唯一碰瀏覽器儲存的檔案。

### 線上對局中禁止引擎

`OnlineMatch` 的快照有 `analysisAllowed`，只有對局結束後才是 `true`。觀戰者也一樣，避免觀戰者把引擎建議轉給玩家。
M4 加入的任何引擎功能（分析、提示、評估條）都必須檢查它；畫面不能直接 import `ai/`，只能經過 `state/`，
所以這是唯一的入口。

## 電腦對手與分析（M4）

```
views/ComputerGameView、AnalysisView
        │  useStore()
        ▼
state/ComputerMatch（對電腦）、AnalysisSession（賽後分析）、getEngine（每頁共用一個引擎）
        │
        ▼
ai/UciEngine ──▶ UciTransport ──▶ Web Worker：engine/stockfish-19-lite-single.js（＋ .wasm）
                                └▶ 測試：npm 套件 stockfish（Node 中跑同一個引擎）
```

- **引擎**：Stockfish.js 19.0.1 的 lite 單執行緒版，不需要 `SharedArrayBuffer`，所以不必設定 COOP／COEP 標頭。
  `vite.config.ts` 的小外掛把 `.js`、`.wasm` 與 `SOURCE.txt`（GPL 原始碼位置）複製到 `dist/engine/`，開發時也從 `/engine/` 提供。
  只有進入對電腦、提示或賽後分析時才下載（wasm 約 1.2 MB gzip）。
- **`ai/`**：
  - `uci.ts`：解析 `info` 與 `bestmove`（純函式）。
  - `engine.ts`：`UciEngine`，請求依序排隊。初始化時會重送 `isready`，因為有些環境在引擎載入完成前會丟掉輸入。
  - `levels.ts`：八個難度。低難度靠 Stockfish 的 `Skill Level`，並限制深度與時間。
  - `analysis.ts`：分數轉白方勝率（Lichess 公開的 logistic 曲線），以及依走子方勝率下降判斷好壞手：
    10 點不精確、20 點錯著、30 點大錯；走了引擎首選就是「最佳」。
- **`ComputerMatch`**：棋步存在一個不計時的 `LocalMatch` 裡，所以勝負與和棋判定與其他模式完全相同。
  電腦在輪到它時搜尋；可聲明和棋而且自己不佔優時就聲明。悔棋會退回到玩家的上一個回合。
- **`AnalysisSession`**：逐一評估每個局面（深度 12），算出每手的判斷與雙方的錯誤統計，並記住引擎首選（畫成箭頭）。
  已經結束的局面（將死、和棋）不問引擎，直接給定勝率。

### 引擎只看結束的對局

- `MatchSnapshot.analysis` 只有在對局結束後才有值。賽後分析只能從它開始，畫面把它存到 `localStorage` 再前往 `#/analysis`。
- 線上對局另外再看 `OnlineSnapshot.analysisAllowed`；進行中的線上對局沒有提示、沒有分析按鈕。
- 提示只存在於對電腦的模式。
- 這些限制都在 `state/` 與畫面上把關。瀏覽器端的限制擋不住有心人自己開別的引擎，
  目的是讓這個網站本身不會在對局中提供引擎協助。

## 一盤棋的控制器：`state/`（M2）

```
LocalMatch（之後的 OnlineMatch 也一樣）
  record：起始 FEN、時制、moves[{uci, t}]、events[{type, by, ply, t}]
     │  每次變動都整份重演
     ▼
  core.replayMatch(record, now) ──▶ MatchSnapshot ──▶ store ──▶ useStore() ──▶ 畫面
```

- `LocalMatch` 只保存紀錄（record），每次走子、悔棋或新增事件都重演整份紀錄，產生不可變的 `MatchSnapshot`。
  快照內容包括：局面、合法手、棋譜、將軍格、結果、提和、可聲明的和棋、棋鐘。
- `store.ts` 是很小的可觀察值。畫面用 `components/useStore.ts`（`useSyncExternalStore`）訂閱；
  `state/` 本身不依賴 React。
- 動作：`play`、`undo`、`resign`、`offerDraw`、`acceptDraw`、`claimDraw`、`tick`（檢查超時）。
  認輸、提和、聲明和棋都由**輪到走棋的一方**提出；接受和棋由提和方的對手提出。
- 棋鐘從白方第一手開始走，所以第一手不耗時。計時對局不能悔棋。
- 紀錄可以 `toJSON()` 存起來、`fromJSON()` 還原（會驗證格式）。雙人同機把它存在 `localStorage`，
  重新整理後接著下。這是畫面層（`views/`）的事，`state/` 不碰儲存。

## 介面

- 路由用網址雜湊：`#/` 首頁、`#/local` 雙人同機、`#/computer` 對電腦、`#/analysis` 賽後分析、
  `#/online` 大廳、`#/r/<房號>` 線上房間。靜態主機不需要轉址設定。
- 所有文字都經過 `i18n/`：預設繁體中文（`zh-TW`），英文字典 `en.ts` 的型別是 `Messages`，
  少一個或多一個 key 都會型別錯誤。

### 棋盤：`board/`

- 棋盤、棋子、提示與動畫都是自製 SVG（`viewBox` 800×800，每格 100），不使用外部棋子圖片。
  棋子造型在 `pieces.tsx`，是本專案原創的簡化 Staunton 風格。
- `ChessBoard` 只收 `pieces`、`legalMoves`、`lastMove`、`checkSquare`、`orientation`，走好之後呼叫 `onMove`。
  合法手清單是空的，棋盤就只能看不能動。
- 操作：點選（再點一次取消）或拖曳；可以走的格子顯示圓點，可以吃子的格子顯示圓環。
  升變時在目標格展開四個棋子讓玩家選。
- 動畫：`identity.ts` 依上一個局面與最後一手，替每枚棋子決定穩定的 id。
  id 不變的棋子在 React 裡不會重建，換了 `transform` 就由 CSS transition 滑過去；
  升變的兵沿用原本的 id，王車易位的車也會滑動。若系統設定「減少動態效果」，就不播動畫。
- 鍵盤操作棋盤還沒有做，列在之後的改進。

## 部署（M5）

部署到本專案專屬的 Cloudflare Pages：建置指令 `npm run build`，輸出 `dist/`。
Firebase 設定以 `VITE_FIREBASE_*` 環境變數在建置時注入，變數名稱見 `.env.example`。
不使用 Cloudflare Worker 或其他伺服器。
