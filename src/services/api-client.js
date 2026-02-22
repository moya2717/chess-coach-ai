import axios from 'axios';

const DEFAULT_API_BASE_URL = import.meta.env.DEV ? '' : '/';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
const DEFAULT_TIMEOUT_MS = 45_000;

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT_MS,
});

export async function apiGet(path, params = {}) {
  const response = await client.get(path, { params });
  return response.data;
}

export async function apiPost(path, payload = {}, config = {}) {
  const response = await client.post(path, payload, config);
  return response.data;
}

export function buildUserFacingApiError(error, fallback = 'Request failed. Please try again.') {
  const status = error?.response?.status;
  const payload = error?.response?.data || {};
  const serverMessage = typeof payload.message === 'string' ? payload.message : '';

  if (status === 429 || payload.code === 'UPSTREAM_RATE_LIMIT') {
    return 'Rate limit reached from a chess provider. Please wait ~30-60 seconds and retry.';
  }

  if (status === 503 && payload.retryable) {
    return 'Chess provider is temporarily unavailable. Please retry in a moment.';
  }

  return serverMessage || error?.message || fallback;
}
