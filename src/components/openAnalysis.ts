import type { AnalysisRequest } from '../state/index.ts';

export const ANALYSIS_STORAGE_KEY = 'chess.analysis.v1';

/** Remember a finished game and open the review screen. */
export function openAnalysis(request: AnalysisRequest): void {
  try {
    localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(request));
  } catch {
    // Without storage the review page shows its empty state.
  }
  window.location.hash = '#/analysis';
}
