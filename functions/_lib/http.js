import { AppError } from './errors.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

export function methodNotAllowed(allowed) {
  return json(
    { error: { code: 'method_not_allowed', message: 'Method not allowed.' } },
    405,
    { Allow: allowed.join(', ') },
  );
}

export async function readJson(request, { maxBytes = 16_384 } = {}) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new AppError(
      415,
      'unsupported_media_type',
      'Requests must use application/json.',
    );
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new AppError(413, 'payload_too_large', 'The request is too large.');
  }

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new AppError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
}

export function assertSameOrigin(request, env) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;

  const requestUrl = new URL(request.url);
  const expectedOrigin = env.APP_ORIGIN || requestUrl.origin;
  const origin = request.headers.get('origin');

  if (!origin || origin !== expectedOrigin) {
    throw new AppError(
      403,
      'invalid_origin',
      'This request did not come from the authorised website.',
    );
  }
}

export async function handleApi(handler) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof AppError) {
      return json(
        {
          error: {
            code: error.code,
            message: error.message,
            ...(error.details ? { details: error.details } : {}),
          },
        },
        error.status,
      );
    }

    console.error('Unhandled API error', error);
    return json(
      {
        error: {
          code: 'internal_error',
          message: 'The service could not complete this request.',
        },
      },
      500,
    );
  }
}

export function normaliseEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new AppError(400, 'invalid_email', 'Enter a valid email address.');
  }
  return email;
}

export function requireString(value, field, { max = 500, min = 1 } = {}) {
  const result = String(value ?? '').trim();
  if (result.length < min || result.length > max) {
    throw new AppError(
      400,
      'invalid_field',
      `${field} must be between ${min} and ${max} characters.`,
      { field },
    );
  }
  return result;
}

