// Traditional Chinese (default locale). This file defines the set of message keys:
// every other locale must provide exactly the same keys.
export const zhTW = {
  'app.title': '西洋棋',
  'app.tagline': '在瀏覽器裡下西洋棋：雙人同機、線上對戰、電腦對手與賽後分析。',
  'app.languageSwitch': 'English',
  'app.languageSwitchLabel': '切換語言',
  'home.modesHeading': '模式',
  'home.comingSoon': '開發中',
  'mode.local.title': '雙人同機',
  'mode.local.description': '一台裝置輪流下棋，可以悔棋與翻轉棋盤。',
  'mode.online.title': '線上對戰',
  'mode.online.description': '開房間把代碼傳給朋友，免註冊即可對戰。',
  'mode.computer.title': '電腦對手',
  'mode.computer.description': '和 Stockfish 對弈，可調整難度。',
  'mode.analysis.title': '賽後分析',
  'mode.analysis.description': '逐手復盤，標出好棋與失誤。',
  'footer.license': '以 GPL-3.0 授權釋出',
  'footer.source': '原始碼',
} as const;

export type MessageKey = keyof typeof zhTW;
export type Messages = Record<MessageKey, string>;
