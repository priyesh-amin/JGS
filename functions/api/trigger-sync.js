import { requireAdmin } from '../_lib/auth.js';
import { AppError } from '../_lib/errors.js';
import { assertSameOrigin, handleApi, json } from '../_lib/http.js';

export function onRequestPost(context) {
  return handleApi(async () => {
    if (!context.env.DB) {
      throw new AppError(
        503,
        'database_not_configured',
        'The secure booking database is not configured.',
      );
    }
    await requireAdmin(context);
    assertSameOrigin(context.request, context.env);

    if (!context.env.GH_PAT) {
      throw new AppError(
        503,
        'github_sync_not_configured',
        'The GitHub content synchronisation secret is not configured.',
      );
    }

    const response = await fetch(
      'https://api.github.com/repos/priyesh-amin/JGS/dispatches',
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${context.env.GH_PAT}`,
          'Content-Type': 'application/json',
          'User-Agent': 'JGS-Admin-Dashboard',
        },
        body: JSON.stringify({ event_type: 'sync_content' }),
      },
    );
    if (!response.ok) {
      throw new AppError(
        502,
        'github_sync_failed',
        'The background content update could not be started.',
      );
    }
    return json({
      success: true,
      message: 'The background content update has started.',
      timestamp: new Date().toISOString(),
    });
  });
}
