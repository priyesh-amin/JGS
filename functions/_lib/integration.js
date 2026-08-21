const LEASE_MINUTES = 5;

function validateWebhookUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) {
    throw new Error('Booking spreadsheet endpoint is not an approved Apps Script URL.');
  }
  return url.toString();
}

function safeSheetText(value, maximum = 500) {
  const text = String(value || '').slice(0, maximum);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function signMessage(secret, timestamp, nonce, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${nonce}.${message}`)));
}

async function claimRows(db, limit, now) {
  const candidates = await db.prepare(`SELECT id FROM integration_outbox WHERE ((status IN ('pending', 'failed') AND (next_attempt_at IS NULL OR next_attempt_at <= ?)) OR (status = 'processing' AND lease_expires_at <= ?)) ORDER BY created_at ASC LIMIT ?`).bind(now, now, limit).all();
  const claimed = [];
  for (const candidate of candidates.results) {
    const leaseToken = crypto.randomUUID();
    const leaseExpiresAt = new Date(new Date(now).getTime() + LEASE_MINUTES * 60_000).toISOString();
    const result = await db.prepare(`UPDATE integration_outbox SET status = 'processing', lease_token = ?, lease_expires_at = ?, attempts = attempts + 1, updated_at = ? WHERE id = ? AND ((status IN ('pending', 'failed') AND (next_attempt_at IS NULL OR next_attempt_at <= ?)) OR (status = 'processing' AND lease_expires_at <= ?))`).bind(leaseToken, leaseExpiresAt, now, candidate.id, now, now).run();
    if (Number(result.meta?.changes || result.changes || 0) === 1) claimed.push({ id: candidate.id, leaseToken });
  }
  return claimed;
}

async function claimedRecord(db, id, leaseToken) {
  return db.prepare(`SELECT o.*, m.email, m.display_name, e.title AS event_title, e.event_date, e.venue, b.status AS booking_status, b.buggy_required, b.dietary_requirements FROM integration_outbox o JOIN bookings b ON b.id = o.aggregate_id JOIN members m ON m.id = b.member_id JOIN events e ON e.id = b.event_id WHERE o.id = ? AND o.status = 'processing' AND o.lease_token = ?`).bind(id, leaseToken).first();
}

function outboundMessage(item, includeDietary) {
  const booking = JSON.parse(item.payload_json);
  return JSON.stringify({
    schemaVersion: 2,
    idempotencyKey: item.idempotency_key,
    eventType: item.event_type,
    booking: { id: booking.id, memberId: booking.memberId, eventId: booking.eventId, registeredAt: booking.registeredAt || null, cancelledAt: booking.cancelledAt || null, updatedAt: booking.updatedAt, version: Number(booking.version) },
    member: { id: booking.memberId, email: safeSheetText(item.email, 254), displayName: safeSheetText(item.display_name, 200) },
    event: { id: booking.eventId, title: safeSheetText(item.event_title, 200), date: item.event_date, venue: safeSheetText(item.venue, 200) },
    operational: { status: item.booking_status, buggyRequired: Boolean(item.buggy_required), dietaryRequirements: includeDietary ? safeSheetText(item.dietary_requirements, 500) : '' },
  });
}

export async function queueBookingReconciliation(db, now = new Date()) {
  const timestamp = now.toISOString();
  const result = await db.prepare(`UPDATE integration_outbox AS current SET status = 'pending', attempts = 0, next_attempt_at = NULL, last_error = NULL, updated_at = ? WHERE current.status = 'sent' AND current.aggregate_type = 'booking' AND current.id = (SELECT latest.id FROM integration_outbox AS latest WHERE latest.aggregate_type = 'booking' AND latest.aggregate_id = current.aggregate_id ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1)`).bind(timestamp).run();
  return Number(result.meta?.changes || result.changes || 0);
}
export async function deliverPendingOutbox(context, { limit = 25, now = new Date() } = {}) {
  const token = context.env.BOOKING_SYNC_TOKEN;
  if (!context.env.BOOKING_SYNC_WEBHOOK_URL || !token) return { configured: false, delivered: 0, failed: 0, message: 'Booking spreadsheet delivery is not configured.' };
  const webhookUrl = validateWebhookUrl(context.env.BOOKING_SYNC_WEBHOOK_URL);
  const nowIso = now.toISOString();
  const claims = await claimRows(context.env.DB, Math.min(Math.max(Number(limit) || 1, 1), 100), nowIso);
  let delivered = 0;
  let failed = 0;
  for (const claim of claims) {
    const item = await claimedRecord(context.env.DB, claim.id, claim.leaseToken);
    if (!item) continue;
    try {
      const message = outboundMessage(item, context.env.BOOKING_SYNC_INCLUDE_DIETARY === 'true');
      const timestamp = Math.floor(now.getTime() / 1000);
      const nonce = crypto.randomUUID();
      const signature = await signMessage(token, timestamp, nonce, message);
      const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timestamp, nonce, signature, message }) });
      if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
      let acknowledgement;
      try { acknowledgement = await response.json(); } catch { throw new Error('Webhook did not return a JSON acknowledgement'); }
      if (acknowledgement?.ok !== true) throw new Error(String(acknowledgement?.error || 'Webhook rejected the update'));
      const sentAt = new Date().toISOString();
      const result = await context.env.DB.prepare(`UPDATE integration_outbox SET status = 'sent', sent_at = ?, updated_at = ?, last_error = NULL, next_attempt_at = NULL, lease_token = NULL, lease_expires_at = NULL WHERE id = ? AND status = 'processing' AND lease_token = ?`).bind(sentAt, sentAt, item.id, claim.leaseToken).run();
      if (Number(result.meta?.changes || result.changes || 0) === 1) delivered += 1;
    } catch (error) {
      const retryMinutes = Math.min(60, 2 ** Math.min(Number(item.attempts || 1), 5));
      const nextAttempt = new Date(Date.now() + retryMinutes * 60_000).toISOString();
      await context.env.DB.prepare(`UPDATE integration_outbox SET status = 'failed', next_attempt_at = ?, last_error = ?, updated_at = ?, lease_token = NULL, lease_expires_at = NULL WHERE id = ? AND status = 'processing' AND lease_token = ?`).bind(nextAttempt, String(error?.message || error).slice(0, 1000), new Date().toISOString(), item.id, claim.leaseToken).run();
      failed += 1;
    }
  }
  return { configured: true, delivered, failed };
}

export async function retryPendingOutbox(
  context,
  { limit = 25, now = new Date() } = {},
) {
  const nowIso = now.toISOString();
  await context.env.DB.prepare(
    `UPDATE integration_outbox
     SET next_attempt_at = NULL, updated_at = ?
     WHERE status = 'failed'
       AND (lease_token IS NULL OR lease_expires_at <= ?)`,
  ).bind(nowIso, nowIso).run();
  return deliverPendingOutbox(context, { limit, now });
}

export async function auditBookingOutput(context, now = new Date()) {
  const token = context.env.BOOKING_SYNC_TOKEN;
  if (!context.env.BOOKING_SYNC_WEBHOOK_URL || !token) return { configured: false, audited: 0 };
  const webhookUrl = validateWebhookUrl(context.env.BOOKING_SYNC_WEBHOOK_URL);
  const result = await context.env.DB.prepare(`SELECT id, version FROM bookings ORDER BY id`).all();
  if (result.results.length > 5000) throw new Error('Booking reconciliation exceeds the safe record limit.');
  const message = JSON.stringify({
    schemaVersion: 2,
    eventType: 'booking.reconciliation',
    idempotencyKey: `booking-reconciliation:${now.toISOString().slice(0, 13)}`,
    canonicalBookings: result.results.map((row) => ({ id: row.id, version: Number(row.version) })),
  });
  const timestamp = Math.floor(now.getTime() / 1000);
  const nonce = crypto.randomUUID();
  const signature = await signMessage(token, timestamp, nonce, message);
  const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timestamp, nonce, signature, message }) });
  if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
  const acknowledgement = await response.json();
  if (acknowledgement?.ok !== true) throw new Error('Booking reconciliation was rejected.');
  return { configured: true, audited: result.results.length, flagged: Number(acknowledgement.flagged || 0) };
}

export async function recordBookingDeliveryStatus(db, delivery, now = new Date()) {
  const timestamp = now.toISOString();
  const unresolvedBefore = new Date(now.getTime() - 15 * 60_000).toISOString();
  const alert = await db.prepare(`SELECT COUNT(*) AS count FROM integration_outbox WHERE status IN ('failed', 'processing') AND (attempts >= 3 OR updated_at <= ?)`).bind(unresolvedBefore).first();
  const alertCount = Number(alert?.count || 0);
  const status = alertCount > 0 ? 'failed' : 'success';
  const summary = { delivered: Number(delivery?.delivered || 0), failed: Number(delivery?.failed || 0), alertCount, primaryOwner: 'Chetan', backupOwner: 'Priyesh' };
  await db.prepare(`INSERT INTO sync_runs (id, sync_type, status, started_at, completed_at, summary_json, error_message) VALUES (?, 'booking_output', ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), status, timestamp, timestamp, JSON.stringify(summary), status === 'failed' ? 'Booking output requires operational review.' : null).run();
  return summary;
}

function syncRecord(row) {
  if (!row) return null;
  return {
    syncType: row.sync_type,
    status: row.status,
    completedAt: row.completed_at || null,
    summary: parseSummary(row.summary_json),
    errorMessage: row.error_message || null,
  };
}

function parseSummary(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function integrationStatus(db) {
  const counts = await db.prepare(`SELECT status, COUNT(*) AS count FROM integration_outbox GROUP BY status`).all();
  const syncs = await db.prepare(`SELECT sync_type, status, completed_at, summary_json, error_message FROM sync_runs WHERE sync_type IN ('fixtures', 'leaderboards', 'booking_output') ORDER BY started_at DESC`).all();
  const latest = {};
  for (const row of syncs.results) if (!latest[row.sync_type]) latest[row.sync_type] = row;
  return {
    outbox: Object.fromEntries(
      counts.results.map((row) => [row.status, Number(row.count)]),
    ),
    lastFixtureSync: syncRecord(latest.fixtures),
    lastLeaderboardSync: syncRecord(latest.leaderboards),
    lastBookingOutput: syncRecord(latest.booking_output),
  };
}
