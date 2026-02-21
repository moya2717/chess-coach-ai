import { apiGet } from './api-client';

export async function getPlayerProfile(username) {
  return apiGet('/api/profile', { username, platform: 'chess.com' });
}

export async function getPlayerStats(username) {
  return apiGet('/api/stats', { username, platform: 'chess.com' });
}

export async function getGameArchives(username) {
  return [];
}

export async function getGamesFromArchive() {
  throw new Error('Archive endpoint is no longer available in the browser client');
}

export async function getRecentGames(username, count = 20, dateFrom = '', dateTo = '') {
  return apiGet('/api/games', {
    username,
    platform: 'chess.com',
    count,
    dateFrom,
    dateTo,
  });
}
