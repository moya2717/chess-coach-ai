import { apiGet, apiPost } from './api-client';

export function getPuzzle(theme) {
  return apiGet('/api/puzzle', { theme });
}

export function getPuzzleProgress(userKey, pattern) {
  return apiGet('/api/puzzle-progress', { userKey, pattern });
}

export function updatePuzzleProgress(payload) {
  return apiPost('/api/puzzle-progress', payload);
}
