import {
  bootstrapAdmin,
  changePassword,
  currentUser,
  login,
  logout,
  requireAdmin,
  requireUser,
} from '../_lib/auth.js';
import {
  confirmedAttendees,
  correctBooking,
  createMember,
  listAdminEvents,
  listMembers,
  resetMemberPassword,
  updateEvent,
  updateMember,
} from '../_lib/admin-store.js';
import {
  cancelMember,
  getEventForMember,
  listEventsForMember,
  registerMember,
} from '../_lib/booking-store.js';
import { AppError } from '../_lib/errors.js';
import {
  assertSameOrigin,
  handleApi,
  json,
  methodNotAllowed,
  readJson,
} from '../_lib/http.js';
import {
  deliverPendingOutbox,
  integrationStatus,
} from '../_lib/integration.js';
import {
  recordFailedSync,
  syncFixtureSheet,
} from '../_lib/sheet-sync.js';

function pathParts(request) {
  return new URL(request.url).pathname
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
}

function ensureDatabase(context) {
  if (!context.env.DB) {
    throw new AppError(
      503,
      'database_not_configured',
      'The secure booking database is not configured.',
    );
  }
}

async function route(context) {
  ensureDatabase(context);
  const parts = pathParts(context.request);
  const method = context.request.method.toUpperCase();

  if (parts[0] === 'setup' && parts[1] === 'bootstrap') {
    if (method !== 'POST') return methodNotAllowed(['POST']);
    assertSameOrigin(context.request, context.env);
    const input = await readJson(context.request);
    return json({ user: await bootstrapAdmin(context, input) }, 201);
  }

  if (parts[0] === 'auth') {
    if (parts[1] === 'login') {
      if (method !== 'POST') return methodNotAllowed(['POST']);
      assertSameOrigin(context.request, context.env);
      const input = await readJson(context.request);
      const result = await login(context, input.email, input.password);
      return json(
        { user: result.user },
        200,
        { 'Set-Cookie': result.cookie },
      );
    }
    if (parts[1] === 'logout') {
      if (method !== 'POST') return methodNotAllowed(['POST']);
      assertSameOrigin(context.request, context.env);
      return json(
        { success: true },
        200,
        { 'Set-Cookie': await logout(context) },
      );
    }
    if (parts[1] === 'session') {
      if (method !== 'GET') return methodNotAllowed(['GET']);
      const user = await currentUser(context);
      return user
        ? json({ user })
        : json(
            {
              error: {
                code: 'unauthenticated',
                message: 'Sign in to continue.',
              },
            },
            401,
          );
    }
    if (parts[1] === 'change-password') {
      if (method !== 'POST') return methodNotAllowed(['POST']);
      assertSameOrigin(context.request, context.env);
      const input = await readJson(context.request);
      return json({
        user: await changePassword(
          context,
          input.currentPassword,
          input.newPassword,
        ),
      });
    }
  }

  if (parts[0] === 'events') {
    const user = await requireUser(context);
    if (parts.length === 1) {
      if (method !== 'GET') return methodNotAllowed(['GET']);
      return json({
        events: await listEventsForMember(context.env.DB, user.id),
      });
    }

    const eventId = parts[1];
    if (parts.length === 2) {
      if (method !== 'GET') return methodNotAllowed(['GET']);
      return json({
        event: await getEventForMember(context.env.DB, user.id, eventId),
      });
    }

    if (parts[2] === 'booking') {
      if (!['POST', 'DELETE'].includes(method)) {
        return methodNotAllowed(['POST', 'DELETE']);
      }
      assertSameOrigin(context.request, context.env);
      const booking = method === 'POST'
        ? await registerMember(context.env.DB, {
            memberId: user.id,
            eventId,
            input: await readJson(context.request),
          })
        : await cancelMember(context.env.DB, {
            memberId: user.id,
            eventId,
          });
      context.waitUntil?.(deliverPendingOutbox(context, { limit: 5 }));
      return json(
        {
          message: method === 'POST'
            ? 'You are confirmed for this event.'
            : 'Your booking has been cancelled.',
          booking,
        },
        method === 'POST' ? 201 : 200,
      );
    }
  }

  if (parts[0] === 'admin') {
    const admin = await requireAdmin(context);

    if (parts[1] === 'members') {
      if (parts.length === 2) {
        if (method === 'GET') {
          return json({ members: await listMembers(context.env.DB) });
        }
        if (method === 'POST') {
          assertSameOrigin(context.request, context.env);
          return json(
            {
              member: await createMember(
                context.env.DB,
                await readJson(context.request),
              ),
            },
            201,
          );
        }
        return methodNotAllowed(['GET', 'POST']);
      }
      const memberId = parts[2];
      if (parts[3] === 'reset-password') {
        if (method !== 'POST') return methodNotAllowed(['POST']);
        assertSameOrigin(context.request, context.env);
        const input = await readJson(context.request);
        return json({
          member: await resetMemberPassword(
            context.env.DB,
            memberId,
            input.temporaryPassword,
          ),
        });
      }
      if (method !== 'PATCH') return methodNotAllowed(['PATCH']);
      assertSameOrigin(context.request, context.env);
      return json({
        member: await updateMember(
          context.env.DB,
          memberId,
          await readJson(context.request),
          admin,
        ),
      });
    }

    if (parts[1] === 'events') {
      if (parts.length === 2) {
        if (method !== 'GET') return methodNotAllowed(['GET']);
        return json({ events: await listAdminEvents(context.env.DB) });
      }
      const eventId = parts[2];
      if (parts[3] === 'registrations') {
        if (method !== 'GET') return methodNotAllowed(['GET']);
        return json(await confirmedAttendees(context.env.DB, eventId));
      }
      if (method !== 'PATCH') return methodNotAllowed(['PATCH']);
      assertSameOrigin(context.request, context.env);
      return json({
        event: await updateEvent(
          context.env.DB,
          eventId,
          await readJson(context.request),
        ),
      });
    }

    if (parts[1] === 'bookings' && parts[2]) {
      if (method !== 'PATCH') return methodNotAllowed(['PATCH']);
      assertSameOrigin(context.request, context.env);
      const booking = await correctBooking(
        context.env.DB,
        parts[2],
        await readJson(context.request),
        admin,
      );
      context.waitUntil?.(deliverPendingOutbox(context, { limit: 5 }));
      return json({ booking });
    }

    if (parts[1] === 'sync') {
      if (method === 'GET') {
        return json(await integrationStatus(context.env.DB));
      }
      if (method !== 'POST') return methodNotAllowed(['GET', 'POST']);
      assertSameOrigin(context.request, context.env);
      const sourceUrl = context.env.MASTER_FIXTURES_CSV_URL;
      if (!sourceUrl) {
        throw new AppError(
          503,
          'fixture_source_not_configured',
          'The fixture spreadsheet source is not configured.',
        );
      }
      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) {
          throw new Error(`Fixture source returned HTTP ${response.status}`);
        }
        const result = await syncFixtureSheet(
          context.env.DB,
          await response.text(),
          new Date(),
          {
            defaultCancellationCutoffDays:
              context.env.DEFAULT_CANCELLATION_CUTOFF_DAYS,
          },
        );
        return json({ sync: result });
      } catch (error) {
        await recordFailedSync(context.env.DB, error);
        throw new AppError(
          502,
          'fixture_sync_failed',
          'Fixture synchronisation failed. Existing event data was preserved.',
        );
      }
    }

    if (parts[1] === 'integration') {
      if (method === 'GET') {
        return json(await integrationStatus(context.env.DB));
      }
      if (method !== 'POST') return methodNotAllowed(['GET', 'POST']);
      assertSameOrigin(context.request, context.env);
      return json({ delivery: await deliverPendingOutbox(context) });
    }
  }

  throw new AppError(404, 'not_found', 'Not found.');
}

export function onRequest(context) {
  return handleApi(() => route(context));
}

