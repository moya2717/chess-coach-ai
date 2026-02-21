import { apiGet } from './api-client';

export async function getPlayerProfile(username) {
  return apiGet('/api/profile', { username, platform: 'lichess' });
}

export async function getRecentGames(username, count = 20, dateFrom = '', dateTo = '') {
  return apiGet('/api/games', {
    username,
    platform: 'lichess',
    count,
    dateFrom,
    dateTo,
  });
}

export async function getCloudEval() {
  return null;
}

export async function getOpeningExplorer() {
  return null;
}

export async function getTablebase() {
  return null;
}

export async function getPuzzles(theme = '', count = 5) {
  return apiGet('/api/puzzles', { theme, count });
}
