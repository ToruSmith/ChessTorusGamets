# core

規則核心（M1）。純 TypeScript，不碰 DOM、網路、儲存或 React，Node 與瀏覽器都能跑。
整個專案只有這一層可以 import `chess.js`，對外只輸出本專案自己的型別與函式。
