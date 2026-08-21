import { AppError } from './errors.js';
import { parseCsv } from './sheet-sync.js';

function normaliseName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('en-GB');
}

export function parseBalancePence(value) {
  const input = String(value ?? '').trim();
  if (!input) return null;
  const negative = /^\(.*\)$/.test(input);
  const cleaned = input.replace(/[£,()\s]/g, '');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(cleaned)) return null;
  const pounds = Number(cleaned);
  if (!Number.isFinite(pounds)) return null;
  const pence = Math.round(pounds * 100);
  return negative ? -Math.abs(pence) : pence;
}

export function findMemberBalance(csvText, displayName) {
  const wanted = normaliseName(displayName);
  const matches = parseCsv(csvText)
    .filter((row) => normaliseName(row[0]) === wanted)
    .map((row) => parseBalancePence(row[1]))
    .filter((balance) => balance !== null);

  if (matches.length === 0) {
    throw new AppError(
      404,
      'balance_not_found',
      'Your balance has not been matched in the Treasurer’s sheet yet.',
    );
  }
  if (matches.length > 1) {
    throw new AppError(
      409,
      'ambiguous_balance',
      'Your balance cannot be shown until the committee resolves a duplicate member name.',
    );
  }
  return matches[0];
}

export function findReconciledOn(csvText) {
  const value = String(parseCsv(csvText)[0]?.[6] || '').trim();
  const ukDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parts = ukDate
    ? [Number(ukDate[3]), Number(ukDate[2]), Number(ukDate[1])]
    : isoDate
      ? [Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3])]
      : null;

  if (!parts) {
    throw new AppError(
      503,
      'balance_reconciliation_date_missing',
      'The Treasurer reconciliation date is missing or invalid.',
    );
  }

  const [year, month, day] = parts;
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    throw new AppError(
      503,
      'balance_reconciliation_date_missing',
      'The Treasurer reconciliation date is missing or invalid.',
    );
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

export function localDateKey(value, timeZone = 'Europe/London') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return [byType.year, byType.month, byType.day].join('-');
}

export function isAfterReconciliation(
  registeredAt,
  reconciledOn,
  timeZone = 'Europe/London',
) {
  const bookedOn = localDateKey(registeredAt, timeZone);
  return bookedOn !== null && bookedOn > reconciledOn;
}

export function allocateBalance(balancePence, bookings) {
  let remainingPence = balancePence;
  return [...bookings]
    .sort((left, right) => (
      String(left.paymentDeadline || left.eventDate).localeCompare(
        String(right.paymentDeadline || right.eventDate),
      )
      || String(left.eventDate).localeCompare(String(right.eventDate))
      || String(left.eventId).localeCompare(String(right.eventId))
    ))
    .map((booking) => {
      const costPence = Number(booking.costPence);
      const existingDeficitPence = Math.max(0, -remainingPence);
      const availablePence = Math.max(0, remainingPence);
      const coveredPence = Math.min(availablePence, costPence);
      const outstandingPence =
        existingDeficitPence + costPence - coveredPence;
      remainingPence = Math.max(0, remainingPence - costPence);
      return {
        eventId: booking.eventId,
        costPence,
        coveredPence,
        outstandingPence,
        isCovered: outstandingPence === 0,
      };
    });
}

export async function memberBalance(context, user) {
  const sourceUrl = context.env.MEMBER_BALANCES_CSV_URL;
  if (!sourceUrl) {
    throw new AppError(
      503,
      'balance_source_not_configured',
      'The member balance source is not configured yet.',
    );
  }

  let response;
  try {
    response = await fetch(sourceUrl, {
      headers: { Accept: 'text/csv' },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
  } catch {
    throw new AppError(
      502,
      'balance_source_unavailable',
      'The Treasurer’s balance sheet is temporarily unavailable.',
    );
  }
  if (!response.ok) {
    throw new AppError(
      502,
      'balance_source_unavailable',
      'The Treasurer’s balance sheet is temporarily unavailable.',
    );
  }

  const csvText = await response.text();
  const balancePence = findMemberBalance(csvText, user.displayName);
  const reconciledOn = findReconciledOn(csvText);
  const result = await context.env.DB.prepare(
    `SELECT b.event_id, b.registered_at, e.cost, e.event_date,
            e.registration_closes_at, e.timezone
     FROM bookings b
     JOIN events e ON e.id = b.event_id
     WHERE b.member_id = ? AND b.status = 'registered'
       AND e.status <> 'completed'
     ORDER BY COALESCE(e.registration_closes_at, e.event_date), e.event_date`,
  ).bind(user.id).all();
  const bookings = result.results
    .map((row) => ({
      eventId: row.event_id,
      registeredAt: row.registered_at,
      eventDate: row.event_date,
      paymentDeadline: row.registration_closes_at,
      timezone: row.timezone || 'Europe/London',
      costPence: parseBalancePence(row.cost),
    }))
    .filter((booking) => booking.costPence !== null && booking.costPence >= 0);
  const laterBookings = bookings.filter((booking) => isAfterReconciliation(
    booking.registeredAt,
    reconciledOn,
    booking.timezone,
  ));
  const reconciledEventIds = bookings
    .filter((booking) => !isAfterReconciliation(
      booking.registeredAt,
      reconciledOn,
      booking.timezone,
    ))
    .map((booking) => booking.eventId);
  const projectedBalancePence = laterBookings.reduce(
    (remaining, booking) => remaining - booking.costPence,
    balancePence,
  );

  return {
    balancePence,
    reconciledOn,
    projectedBalancePence,
    outstandingPence: Math.max(0, -projectedBalancePence),
    currency: 'GBP',
    allocations: allocateBalance(balancePence, laterBookings),
    reconciledEventIds,
    checkedAt: new Date().toISOString(),
  };
}
