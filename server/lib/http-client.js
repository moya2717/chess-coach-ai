import { ApiError } from './errors.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withQuery(url, params = {}) {
  const parsed = new URL(url);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      parsed.searchParams.set(key, String(value));
    }
  });
  return parsed;
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

async function parseResponse(response, responseType) {
  if (responseType === 'text') {
    return response.text();
  }
  return response.json();
}

export async function requestWithRetry(url, config = {}) {
  const {
    method = 'GET',
    headers = {},
    params = {},
    body,
    timeoutMs = 10_000,
    retries = 2,
    backoffMs = 250,
    responseType = 'json',
  } = config;

  const requestUrl = withQuery(url, params);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(requestUrl, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (attempt < retries && isRetryableStatus(response.status)) {
          await sleep(backoffMs * (attempt + 1));
          continue;
        }

        throw new ApiError({
          code: 'UPSTREAM_ERROR',
          message: `Upstream request failed with status ${response.status}`,
          retryable: isRetryableStatus(response.status),
          status: response.status,
        });
      }

      return await parseResponse(response, responseType);
    } catch (error) {
      clearTimeout(timeoutId);
      const isApiError = error instanceof ApiError;
      const timedOut = error?.name === 'AbortError';
      const isFinalAttempt = attempt >= retries;

      if (!isFinalAttempt) {
        if (!isApiError || error.retryable) {
          await sleep(backoffMs * (attempt + 1));
          continue;
        }
      }

      if (isApiError) {
        throw error;
      }

      throw new ApiError({
        code: timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
        message: timedOut ? 'Upstream request timed out' : 'Upstream request failed',
        retryable: true,
        status: 503,
      });
    }
  }

  throw new ApiError({
    code: 'UPSTREAM_UNAVAILABLE',
    message: 'Failed to contact upstream service',
    retryable: true,
    status: 503,
  });
}
