export class ApiError extends Error {
  constructor({ code, message, retryable = false, status = 500, details = null }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    this.details = details;
  }
}

export function normalizeUnknownError(error, fallbackMessage = 'Unexpected server error') {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError({
    code: 'INTERNAL_ERROR',
    message: error?.message || fallbackMessage,
    retryable: false,
    status: 500,
  });
}

export function errorPayload(error) {
  const normalized = normalizeUnknownError(error);
  return {
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
  };
}
