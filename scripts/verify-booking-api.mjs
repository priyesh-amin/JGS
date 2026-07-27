const base = process.env.JGS_TEST_ORIGIN || 'http://127.0.0.1:8788';
const adminEmail = process.env.JGS_ADMIN_EMAIL;
const adminPassword = process.env.JGS_ADMIN_PASSWORD;
const eventId = process.env.JGS_TEST_EVENT_ID || 'sept-monthly-2026';

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
} = {}) {
  const headers = {};
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

let result = await request(`/api/admin/events/${eventId}`, {
  method: 'PATCH',
  cookie: adminCookie,
  body: {
    status: 'open',
    publicationAt: '2026-07-01T00:00:00.000Z',
    registrationOpensAt: '2026-07-01T00:00:00.000Z',
    registrationClosesAt: '2026-09-12T22:59:59.000Z',
    cancellationClosesAt: '2026-09-16T22:59:59.000Z',
    timezone: 'Europe/London',
  },
});
check(result.status === 200, 'configure local test event');

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
  result.status === 403 && result.data.error.code === 'password_change_required',
  'temporary password blocks member data',
);
result = await request('/api/auth/change-password', {
  method: 'POST',
  cookie: memberOneCookie,
  body: {
    currentPassword: members[0].temporaryPassword,
    newPassword: members[0].nextPassword,
  },
});
check(result.status === 200, 'member changes temporary password');
result = await request('/api/admin/events', { cookie: memberOneCookie });
check(result.status === 403, 'member is blocked from administrator API');
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
check(result.status === 201, 'member self-registers');
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
result = await request('/api/auth/change-password', {
  method: 'POST',
  cookie: memberTwoCookie,
  body: {
    currentPassword: members[1].temporaryPassword,
    newPassword: members[1].nextPassword,
  },
});
check(result.status === 200, 'second member changes temporary password');
const concurrent = await Promise.all([
  request(`/api/events/${eventId}/booking`, {
    method: 'POST',
    cookie: memberTwoCookie,
    body: { buggyRequired: false },
  }),
  request(`/api/events/${eventId}/booking`, {
    method: 'POST',
    cookie: memberTwoCookie,
    body: { buggyRequired: false },
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
check(
  result.status === 200
    && result.data.attendees.filter((attendee) => attendee.email === members[1].email).length === 1,
  'administrator attendee list contains one canonical row',
);
result = await request('/api/admin/sync', {
  method: 'POST',
  cookie: adminCookie,
});
check(result.status === 200, 'fixture synchronisation reruns');
result = await request('/api/admin/events', { cookie: adminCookie });
const configured = result.data.events.find((event) => event.id === eventId);
check(
  configured?.registration_opens_at === '2026-07-01T00:00:00.000Z',
  'fixture rerun preserves configured booking windows',
);

console.log('Booking API verification completed successfully.');
