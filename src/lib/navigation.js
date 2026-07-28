export function safeInternalPath(value, fallback = '/events') {
  const path = typeof value === 'string' ? value.trim() : '';
  if (!path || !path.startsWith('/') || path.includes('\\')) return fallback;

  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\')) {
    return fallback;
  }

  return path;
}