import { AppError } from './errors.js';

function asDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function eventAvailability(event, now = new Date()) {
  const current = now instanceof Date ? now : new Date(now);
  const publicationAt = asDate(event.publication_at);
  const opensAt = asDate(event.registration_opens_at);
  const closesAt = asDate(event.registration_closes_at);
  const cancellationClosesAt = asDate(event.cancellation_closes_at);

  if (event.status === 'draft' || (publicationAt && current < publicationAt)) {
    return {
      visibility: 'hidden',
      registration: 'unavailable',
      cancellation: 'unavailable',
      reason: 'not_published',
    };
  }

  if (event.status === 'completed') {
    return {
      visibility: 'visible',
      registration: 'closed',
      cancellation: 'closed',
      reason: 'completed',
    };
  }

  if (!opensAt || !closesAt || !cancellationClosesAt) {
    return {
      visibility: 'visible',
      registration: 'unavailable',
      cancellation: cancellationClosesAt && current < cancellationClosesAt
        ? 'open'
        : 'closed',
      reason: 'configuration_required',
    };
  }

  if (current >= cancellationClosesAt) {
    return {
      visibility: 'visible',
      registration: 'closed',
      cancellation: 'closed',
      reason: 'cancellation_closed',
    };
  }

  if (event.status === 'closed' || current >= closesAt) {
    return {
      visibility: 'visible',
      registration: 'closed',
      cancellation: cancellationClosesAt && current < cancellationClosesAt
        ? 'open'
        : 'closed',
      reason: 'registration_closed',
    };
  }

  if (current < opensAt) {
    return {
      visibility: 'visible',
      registration: 'upcoming',
      cancellation: 'unavailable',
      reason: 'registration_not_open',
    };
  }

  return {
    visibility: 'visible',
    registration: 'open',
    cancellation: cancellationClosesAt && current < cancellationClosesAt
      ? 'open'
      : 'closed',
    reason: 'registration_open',
  };
}

export function assertCanRegister(event, now = new Date()) {
  const availability = eventAvailability(event, now);
  if (availability.registration !== 'open') {
    throw new AppError(
      409,
      availability.reason,
      availability.reason === 'registration_not_open'
        ? 'Registration is not open yet.'
        : 'Registration is not available for this event.',
      { availability },
    );
  }
  return availability;
}

export function assertCanCancel(event, now = new Date()) {
  const availability = eventAvailability(event, now);
  if (availability.cancellation !== 'open') {
    throw new AppError(
      409,
      'cancellation_closed',
      'Cancellation is not available for this event.',
      { availability },
    );
  }
  return availability;
}

export function publicEvent(event, booking, now = new Date()) {
  const availability = eventAvailability(event, now);
  return {
    id: event.id,
    title: event.title,
    venue: event.venue,
    eventDate: event.event_date,
    meetTime: event.meet_time,
    teeTime: event.tee_time,
    cost: event.cost,
    description: event.description,
    joiningInformation: event.joining_information,
    registrationOpensAt: event.registration_opens_at,
    registrationClosesAt: event.registration_closes_at,
    cancellationClosesAt: event.cancellation_closes_at,
    timezone: event.timezone,
    status: event.status,
    attendeeCount: Number(event.attendee_count || 0),
    bookingFields: safeJson(event.booking_fields_json, {}),
    availability,
    booking: booking
      ? {
          status: booking.status,
          buggyRequired: Boolean(booking.buggy_required),
          dietaryRequirements: booking.dietary_requirements || '',
          preferences: safeJson(booking.preferences_json, {}),
          registeredAt: booking.registered_at,
          cancelledAt: booking.cancelled_at,
          updatedAt: booking.updated_at,
        }
      : null,
  };
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

