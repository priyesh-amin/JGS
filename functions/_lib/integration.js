export async function deliverPendingOutbox(context, { limit = 25 } = {}) {
  const webhookUrl = context.env.BOOKING_SYNC_WEBHOOK_URL;
  const token = context.env.BOOKING_SYNC_TOKEN;
  if (!webhookUrl || !token) {
    return {
      configured: false,
      delivered: 0,
      failed: 0,
      message: 'Booking spreadsheet delivery is not configured.',
    };
  }

  const now = new Date().toISOString();
  const result = await context.env.DB.prepare(
    `SELECT o.*, m.email, m.display_name, e.title AS event_title,
            e.event_date, b.status AS booking_status, b.buggy_required,
            b.dietary_requirements, b.preferences_json
     FROM integration_outbox o
     JOIN bookings b ON b.id = o.aggregate_id
     JOIN members m ON m.id = b.member_id
     JOIN events e ON e.id = b.event_id
     WHERE o.status IN ('pending', 'failed')
       AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= ?)
     ORDER BY o.created_at ASC
     LIMIT ?`,
  ).bind(now, limit).all();

  let delivered = 0;
  let failed = 0;
  for (const item of result.results) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': item.idempotency_key,
        },
        body: JSON.stringify({
          schemaVersion: 1,
          webhookToken: token,
          idempotencyKey: item.idempotency_key,
          eventType: item.event_type,
          booking: JSON.parse(item.payload_json),
          member: {
            id: JSON.parse(item.payload_json).memberId,
            email: item.email,
            displayName: item.display_name,
          },
          event: {
            id: JSON.parse(item.payload_json).eventId,
            title: item.event_title,
            date: item.event_date,
          },
          operational: {
            status: item.booking_status,
            buggyRequired: Boolean(item.buggy_required),
            dietaryRequirements: item.dietary_requirements || '',
            preferences: JSON.parse(item.preferences_json || '{}'),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned HTTP ${response.status}`);
      }
      let acknowledgement;
      try {
        acknowledgement = await response.json();
      } catch {
        throw new Error('Webhook did not return a JSON acknowledgement');
      }
      if (acknowledgement?.ok !== true) {
        throw new Error(
          String(acknowledgement?.error || 'Webhook rejected the update'),
        );
      }
      const sentAt = new Date().toISOString();
      await context.env.DB.prepare(
        `UPDATE integration_outbox
         SET status = 'sent', attempts = attempts + 1, sent_at = ?,
             updated_at = ?, last_error = NULL, next_attempt_at = NULL
         WHERE id = ?`,
      ).bind(sentAt, sentAt, item.id).run();
      delivered += 1;
    } catch (error) {
      const attempts = Number(item.attempts || 0) + 1;
      const retryMinutes = Math.min(60, 2 ** Math.min(attempts, 5));
      const nextAttempt = new Date(
        Date.now() + retryMinutes * 60_000,
      ).toISOString();
      await context.env.DB.prepare(
        `UPDATE integration_outbox
         SET status = 'failed', attempts = ?, next_attempt_at = ?,
             last_error = ?, updated_at = ?
         WHERE id = ?`,
      ).bind(
        attempts,
        nextAttempt,
        String(error?.message || error).slice(0, 1_000),
        new Date().toISOString(),
        item.id,
      ).run();
      failed += 1;
    }
  }

  return { configured: true, delivered, failed };
}

export async function integrationStatus(db) {
  const counts = await db.prepare(
    `SELECT status, COUNT(*) AS count
     FROM integration_outbox
     GROUP BY status`,
  ).all();
  const lastFixtureSync = await db.prepare(
    `SELECT status, completed_at, summary_json, error_message
     FROM sync_runs
     WHERE sync_type = 'fixtures'
     ORDER BY started_at DESC LIMIT 1`,
  ).first();
  return {
    outbox: Object.fromEntries(
      counts.results.map((row) => [row.status, Number(row.count)]),
    ),
    lastFixtureSync: lastFixtureSync || null,
  };
}
