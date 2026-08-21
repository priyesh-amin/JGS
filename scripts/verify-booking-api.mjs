const base = process.env.JGS_TEST_ORIGIN || 'http://127.0.0.1:8788';
const adminEmail = process.env.JGS_ADMIN_EMAIL;
const adminPassword = process.env.JGS_ADMIN_PASSWORD;
const bootstrapToken = process.env.JGS_BOOTSTRAP_TOKEN;
const eventId = process.env.JGS_TEST_EVENT_ID || 'sept-monthly-2026';
const parsedOrigin = new URL(base);
const isolatedHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
if (
  process.env.JGS_TEST_MODE !== 'isolated-local'
  || !isolatedHosts.has(parsedOrigin.hostname)
  || !['http:', 'https:'].includes(parsedOrigin.protocol)
) {
  throw new Error(
    'Refusing mutation verification outside an explicit isolated-local origin.',
  );
}

if (!adminEmail || !adminPassword) {
  throw new Error('Set JGS_ADMIN_EMAIL and JGS_ADMIN_PASSWORD for a local test administrator.');
}

function check(condition, label, detail = '') {
  if (!condition) throw new Error(`FAIL: ${label}${detail ? ` (${detail})` : ''}`);
  console.log(`PASS: ${label}`);
}

async function request(path, {
  method = 'GET',
  body,
  cookie,
  includeOrigin = true,
  headers: extraHeaders = {},
} = {}) {
  const headers = { ...extraHeaders };
  if (includeOrigin) headers.Origin = base;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return {
    status: response.status,
    data,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

async function login(email, password) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  check(result.status === 200, `sign in ${email}`, JSON.stringify(result.data));
  return result.cookie;
}

if (bootstrapToken) {
  const bootstrap = await request('/api/setup/bootstrap', {
    method: 'POST',
    headers: { 'X-Bootstrap-Token': bootstrapToken },
    body: {
      displayName: 'Local API Administrator',
      email: adminEmail,
      password: adminPassword,
    },
  });
  check(
    bootstrap.status === 201
      || bootstrap.data?.error?.code === 'bootstrap_completed',
    'isolated local administrator bootstrap is ready',
  );
}

const adminCookie = await login(adminEmail, adminPassword);
const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const members = [
  {
    displayName: 'API Test Member One',
    email: `api-member-one-${suffix}@example.invalid`,
    temporaryPassword: 'Member-Temp-Password-2026!',
    nextPassword: 'Member-One-New-Password-2026!',
  },
  {
    displayName: 'API Test Member Two',
    email: `api-member-two-${suffix}@example.invalid`,
    temporaryPassword: 'Member-Temp-Password-2026!',
    nextPassword: 'Member-Two-New-Password-2026!',
  },
];

let result = await request('/api/admin/events', { cookie: adminCookie });
const configuredEvent = result.data?.events?.find((entry) => entry.id === eventId);
check(
  result.status === 200
    && configuredEvent?.source_type === 'google_sheet'
    && ['published', 'open'].includes(configuredEvent?.status)
    && configuredEvent?.registration_opens_at
    && configuredEvent?.registration_closes_at
    && configuredEvent?.cancellation_closes_at,
  'isolated canonical test fixture is configured with all exact windows',
);

for (const member of members) {
  result = await request('/api/admin/members', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      displayName: member.displayName,
      email: member.email,
      temporaryPassword: member.temporaryPassword,
      role: 'member',
      status: 'active',
    },
  });
  check(result.status === 201, `create ${member.displayName}`);
}

const memberOneCookie = await login(members[0].email, members[0].temporaryPassword);
result = await request('/api/events', { cookie: memberOneCookie });
check(
  result.status === 200 && Array.isArray(result.data.events),
  'member can access fixtures without a forced password change',
);
result = await request('/api/admin/events', { cookie: memberOneCookie });
check(result.status === 403, 'member is blocked from administrator API');
result = await request('/api/admin/operations', { cookie: memberOneCookie });
check(
  result.status === 403
    && !JSON.stringify(result.data).includes('docs.google.com'),
  'member cannot receive restricted operations links',
);
result = await request(`/api/events/${eventId}/booking`, {
  method: 'POST',
  cookie: memberOneCookie,
  includeOrigin: false,
  body: { buggyRequired: false },
});
check(
  result.status === 403 && result.data.error.code === 'invalid_origin',
  'cross-origin mutation is rejected',
);
result = await request(`/api/events/${eventId}/booking`, {
  method: 'POST',
  cookie: memberOneCookie,
  body: { buggyRequired: true, dietaryRequirements: 'Vegetarian' },
});
check(
  result.status === 400 && result.data.error.code === 'invalid_dietary_choice',
  'arbitrary dietary text is rejected',
);
result = await request(`/api/events/${eventId}/booking`, {
  method: 'POST',
  cookie: memberOneCookie,
  body: { buggyRequired: true, dietaryRequirements: 'Veg' },
});
check(
  result.status === 201
    && result.data.booking.dietaryRequirements === 'Veg',
  'member self-registers with the canonical Veg choice',
);
result = await request(`/api/events/${eventId}/booking`, {
  method: 'POST',
  cookie: memberOneCookie,
  body: { buggyRequired: true },
});
check(
  result.status === 409 && result.data.error.code === 'already_registered',
  'sequential duplicate is rejected',
);
result = await request(`/api/events/${eventId}/booking`, {
  method: 'DELETE',
  cookie: memberOneCookie,
});
check(result.status === 200 && result.data.booking.status === 'cancelled', 'self-cancellation succeeds');

const memberTwoCookie = await login(members[1].email, members[1].temporaryPassword);
const concurrent = await Promise.all([
  request(`/api/events/${eventId}/booking`, {
    method: 'POST',
    cookie: memberTwoCookie,
    body: { buggyRequired: false, dietaryRequirements: 'Non-veg' },
  }),
  request(`/api/events/${eventId}/booking`, {
    method: 'POST',
    cookie: memberTwoCookie,
    body: { buggyRequired: false, dietaryRequirements: 'Non-veg' },
  }),
]);
const statuses = concurrent.map((entry) => entry.status).sort();
check(
  statuses[0] === 201 && statuses[1] === 409,
  'concurrent duplicate produces one active booking',
  statuses.join(','),
);
result = await request(`/api/admin/events/${eventId}/registrations`, {
  cookie: adminCookie,
});
const memberTwoBooking = result.data?.attendees?.find(
  (attendee) => attendee.email === members[1].email,
);
check(
  result.status === 200
    && result.data.attendees.filter((attendee) => attendee.email === members[1].email).length === 1
    && memberTwoBooking.dietary_requirements === 'Non-veg',
  'administrator attendee list contains one canonical row',
);
result = await request(`/api/admin/bookings/${encodeURIComponent(memberTwoBooking.booking_id)}`, {
  method: 'PATCH',
  cookie: adminCookie,
  body: {
    buggyRequired: false,
    dietaryRequirements: 'Veg',
    status: 'registered',
  },
});
check(
  result.status === 200 && result.data.booking.dietaryRequirements === 'Veg',
  'administrator correction enforces and persists the same dietary enum',
);

result = await request('/api/admin/operations', { cookie: adminCookie });
check(
  result.status === 200
    && Array.isArray(result.data.sources)
    && result.data.sources.some((source) => source.id === 'booking_output'),
  'administrator operations guide is available',
);
result = await request('/api/admin/sync', { cookie: adminCookie });
check(
  result.status === 200 && typeof result.data.outbox === 'object',
  'administrator integration status is available',
);
result = await request('/api/leaderboards', { includeOrigin: false });
check(
  result.status === 200 && typeof result.data.leaderboards === 'object',
  'validated Hall of Fame endpoint returns JSON',
);
console.log('PASS: verifier did not mutate or resynchronise the authoritative fixture source');

console.log('Booking API verification completed successfully.');
