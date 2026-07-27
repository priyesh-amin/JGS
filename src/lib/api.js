export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload.error || {};
    throw new ApiError(
      response.status,
      error.code || 'request_failed',
      error.message || 'The request could not be completed.',
      error.details,
    );
  }
  return payload;
}

export const api = {
  get(path) {
    return request(path);
  },
  post(path, body = {}) {
    return request(path, { method: 'POST', body: JSON.stringify(body) });
  },
  patch(path, body = {}) {
    return request(path, { method: 'PATCH', body: JSON.stringify(body) });
  },
  delete(path, body) {
    return request(path, {
      method: 'DELETE',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  },
};

