import { integrationStatus } from './integration.js';

const LAST_SOURCE_REVIEW = '2026-07-29';

function workbookLink(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || url.hostname !== 'docs.google.com'
      || !/^\/spreadsheets\/d\/[^/]+(?:\/|$)/.test(url.pathname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function safeError(value) {
  if (!value) return null;
  return String(value)
    .replace(/https?:\/\/[^\s)]+/gi, '[redacted URL]')
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi, '[redacted email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[redacted identifier]')
    .slice(0, 300);
}

function syncState(sync, fallback = 'Not yet run') {
  if (!sync) {
    return {
      state: 'not_run',
      label: fallback,
      lastRunAt: null,
      error: null,
    };
  }
  return {
    state: sync.status === 'success' ? 'healthy' : 'attention',
    label: sync.status === 'success' ? 'Healthy' : 'Attention required',
    lastRunAt: sync.completedAt || null,
    error: safeError(sync.errorMessage),
  };
}

function linkState(value) {
  if (!value) return { link: null, linkStatus: 'not_configured' };
  const link = workbookLink(value);
  return link
    ? { link, linkStatus: 'available' }
    : { link: null, linkStatus: 'misconfigured' };
}

function source({ linkValue, ...source }) {
  return {
    ...source,
    lastVerifiedAt: LAST_SOURCE_REVIEW,
    ...linkState(linkValue),
  };
}

export async function operationsDashboard(context) {
  const status = await integrationStatus(context.env.DB);
  const fixtureSync = syncState(status.lastFixtureSync);
  const leaderboardSync = syncState(status.lastLeaderboardSync);
  const bookingSync = syncState(
    status.lastBookingOutput,
    'Awaiting external adapter setup',
  );

  return {
    canonicalRules: [
      'D1 is canonical for accounts, sessions, website bookings, booking audit and delivery state.',
      'Sheets are authoritative only for their named source data.',
      'Booking changes flow one way from the website and D1 to the approved operational workbook; spreadsheet rows are not edited back into D1.',
    ],
    flow: [
      {
        id: 'sources',
        title: 'Authoritative sheets',
        detail: 'Fixtures, historical winners and balances are maintained in their approved source tabs.',
        owner: 'Named committee source owner',
      },
      {
        id: 'validation',
        title: 'Validation and synchronisation',
        detail: 'The scheduled worker validates fixture and Hall of Fame data and preserves the last valid snapshot on failure.',
        owner: 'Automated worker; Chetan handles source corrections',
      },
      {
        id: 'canonical',
        title: 'D1 and website',
        detail: 'D1 serves authenticated accounts and bookings plus the validated public event and Hall of Fame views.',
        owner: 'Website administrator',
      },
      {
        id: 'outputs',
        title: 'Operational outputs',
        detail: 'Signed, retryable booking updates project approved fields into the restricted booking workbook.',
        owner: 'Chetan; Priyesh is recovery backup',
      },
    ],
    sources: [
      source({
        id: 'fixtures',
        label: 'Fixture source',
        workbook: 'Jaguar_Golf_Society_QA_Compliance_Matrix',
        tab: 'DB_Fixtures',
        purpose: 'Event details, publication status and exact booking-window inputs for the approved fixture roster.',
        owner: 'Chetan / committee fixture owner',
        classification: 'Committee operational data',
        direction: 'Sheet → validation and sync → D1 and website',
        sync: fixtureSync,
        recovery: 'Correct the named source row, keep the stable fixture ID, then run fixture synchronisation again. Invalid rows remain safely unbookable.',
        linkValue: context.env.FIXTURES_WORKBOOK_URL,
      }),
      source({
        id: 'leaderboards',
        label: 'Historical Hall of Fame',
        workbook: 'Jaguar_Golf_Society_QA_Compliance_Matrix',
        tab: 'DB_Leaderboards',
        purpose: 'Historical winners for the four existing public Hall of Fame categories; it is not a current-points table.',
        owner: 'Unresolved – committee maintainer must be confirmed',
        classification: 'Committee and public-results data',
        direction: 'Sheet → validation and sync → D1 snapshot → public Hall of Fame',
        sync: leaderboardSync,
        recovery: 'Correct the source row and rerun the scheduled sync. A failed import preserves the previous valid Hall of Fame snapshot.',
        linkValue: context.env.LEADERBOARDS_WORKBOOK_URL,
      }),
      source({
        id: 'balances',
        label: 'Payments and balances',
        workbook: 'JGS_Members_Balance',
        tab: 'Sheet1',
        purpose: 'Member balance and reconciliation input used for each signed-in member’s private balance view.',
        owner: 'Chetan',
        classification: 'Restricted financial and member data',
        direction: 'Sheet → read-only, per-member reconciliation → member portal',
        sync: {
          state: 'on_demand',
          label: 'Read on demand',
          lastRunAt: null,
          error: null,
        },
        recovery: 'Check the reconciliation date cell and unique member matching. Do not expose or copy the complete sheet into the browser.',
        linkValue: context.env.MEMBER_BALANCES_WORKBOOK_URL,
      }),
      source({
        id: 'booking_output',
        label: 'Booking management and Sync Log',
        workbook: 'JGS Booking Management',
        tab: 'Bookings / Sync Log',
        purpose: 'Restricted one-way operational projection of canonical D1 bookings and delivery outcomes.',
        owner: 'Chetan; Priyesh is recovery backup',
        classification: 'Restricted booking and member data',
        direction: 'Website and D1 outbox → signed adapter → workbook; never two-way editing',
        sync: bookingSync,
        recovery: 'Review Sync Log, resolve adapter or formula collisions, then retry pending delivery. Never delete D1 bookings or sheet rows to clear an error.',
        linkValue: context.env.BOOKING_MANAGEMENT_WORKBOOK_URL,
      }),
      source({
        id: 'member_finance_links',
        label: 'Member finance links (restricted)',
        workbook: 'Players_Specific_URLs',
        tab: 'Sheet1',
        purpose: 'Committee directory of member finance links. Its authority over D1 finance mappings is not approved.',
        owner: 'Unresolved – Priyesh/Chetan decision required',
        classification: 'Highly restricted member PII and personal-finance links',
        direction: 'Reference-only until authority and stable identity matching are approved',
        sync: {
          state: 'unresolved',
          label: 'Authority unresolved',
          lastRunAt: null,
          error: null,
        },
        recovery: 'Do not automate or match by display name. Confirm the owner, authority and stable identity key before any one-way import is designed.',
        linkValue: context.env.MEMBER_FINANCE_LINKS_WORKBOOK_URL,
      }),
      source({
        id: 'other_member_portal',
        label: 'Other member-portal sources',
        workbook: 'Not yet confirmed',
        tab: 'Not yet confirmed',
        purpose: 'Placeholder for an approved future inventory only; no source or link is inferred.',
        owner: 'Unresolved – Priyesh/Chetan decision required',
        classification: 'Presume restricted until classified',
        direction: 'No authority or synchronisation direction assigned',
        sync: {
          state: 'unresolved',
          label: 'Source unresolved',
          lastRunAt: null,
          error: null,
        },
        recovery: 'Confirm the exact workbook, tab, owner, sharing scope and data direction before adding it.',
        linkValue: null,
      }),
    ],
    routineChecks: [
      'Check fixture and Hall of Fame status after source changes and confirm the latest run is healthy.',
      'Check pending and failed booking-output counts; investigate at three attempts or fifteen unresolved minutes.',
      'Confirm booking windows remain exact and authoritative before expecting registration to open.',
      'Open restricted workbooks only from this administrator view and verify access is no broader than intended.',
      'Never resolve a sync problem by editing D1 booking data or by creating replacement production records.',
    ],
    escalation: [
      'Source content or booking-window problem: Chetan or the named committee source owner.',
      'Booking-output delivery failure: Chetan first, Priyesh as recovery backup.',
      'Authentication, D1, Cloudflare or deployment problem: Priyesh; preserve the current deployment and export/rollback evidence before mutation.',
      'Unknown owner, sharing request or member identity match: stop and obtain committee approval.',
    ],
  };
}
