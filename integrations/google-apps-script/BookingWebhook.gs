const BOOKING_SHEET = 'Bookings';
const SYNC_LOG_SHEET = 'Sync Log';
const HEADER_ROW = 4;
const PASSWORD_RESET_URL_PREFIX = 'https://jaguargolfsociety.siteproductions.co.uk/reset-password#token=';

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'JGS booking spreadsheet adapter',
  });
}

function doPost(e) {
  const startedAt = new Date();
  let payload;
  let lock;

  try {
    const envelope = JSON.parse(e && e.postData && e.postData.contents || '{}');
    payload = authenticateEnvelope_(envelope);
    validatePayload_(payload);

    if (payload.eventType === 'password.reset') {
      sendPasswordResetEmail_(payload);
      return jsonResponse_({ ok: true });
    }

    lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      throw new Error('The booking sheet is busy. Retry the update.');
    }

    const spreadsheet = configuredSpreadsheet_();
    if (payload.eventType === 'booking.reconciliation') {
      const flagged = auditBookingOutput_(
        requiredSheet_(spreadsheet, BOOKING_SHEET),
        requiredSheet_(spreadsheet, SYNC_LOG_SHEET),
        payload,
        startedAt,
      );
      return jsonResponse_({ ok: true, flagged: flagged });
    }
    const bookingSheet = requiredSheet_(spreadsheet, BOOKING_SHEET);
    const result = upsertBooking_(bookingSheet, payload);
    appendSyncLog_(
      requiredSheet_(spreadsheet, SYNC_LOG_SHEET),
      payload,
      'Succeeded',
      startedAt,
      '',
    );

    return jsonResponse_({
      ok: true,
      idempotencyKey: payload.idempotencyKey,
      duplicate: result.duplicate,
      stale: result.stale,
      row: result.row,
    });
  } catch (error) {
    if (!payload || payload.eventType !== 'password.reset') {
      try {
        const spreadsheet = configuredSpreadsheet_();
        appendSyncLog_(
          requiredSheet_(spreadsheet, SYNC_LOG_SHEET),
          payload || {},
          'Failed',
          startedAt,
          String(error && error.message || error).slice(0, 1000),
        );
      } catch (logError) {
        console.error('Unable to append the failed sync log', logError);
      }
    }
    return jsonResponse_({
      ok: false,
      error: 'Booking update was rejected.',
    });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function configuredSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is not configured.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function authenticateEnvelope_(envelope) {
  const expectedToken = PropertiesService.getScriptProperties()
    .getProperty('BOOKING_SYNC_TOKEN');
  if (!expectedToken) throw new Error('BOOKING_SYNC_TOKEN is not configured.');
  const timestamp = Number(envelope.timestamp);
  const nonce = String(envelope.nonce || '');
  const message = String(envelope.message || '');
  const signature = String(envelope.signature || '').toLowerCase();
  if (!Number.isInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300 || !nonce || nonce.length > 100 || !message || message.length > 20000) throw new Error('Invalid request envelope.');
  const purpose = String(envelope.purpose || '');
  if (purpose && purpose !== 'password_reset') throw new Error('Invalid request purpose.');
  const signedMessage = (purpose ? purpose + '.' : '') + timestamp + '.' + nonce + '.' + message;
  const expectedSignature = Utilities.computeHmacSha256Signature(signedMessage, expectedToken).map(function (value) {
    return ((value + 256) % 256).toString(16).padStart(2, '0');
  }).join('');
  if (!constantTimeEquals_(signature, expectedSignature)) throw new Error('Unauthorised booking update.');
  const nonceCache = CacheService.getScriptCache();
  const nonceKey = 'request-nonce:' + nonce;
  if (nonceCache.get(nonceKey)) throw new Error('Replayed request envelope.');
  nonceCache.put(nonceKey, '1', 600);
  return JSON.parse(message);
}

function constantTimeEquals_(left, right) {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return mismatch === 0;
}
function validatePayload_(payload) {
  if (payload.eventType === 'password.reset') {
    if (payload.schemaVersion !== 1) throw new Error('Unsupported reset schema version.');
    const recipient = String(payload.recipient || '').trim();
    const displayName = String(payload.displayName || '').trim();
    const resetUrl = String(payload.resetUrl || '');
    const expiresAt = new Date(payload.expiresAt || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 254) throw new Error('Invalid reset recipient.');
    if (!displayName || displayName.length > 120) throw new Error('Invalid reset display name.');
    if (resetUrl.indexOf(PASSWORD_RESET_URL_PREFIX) !== 0 || !/^[A-Za-z0-9_-]{43,128}$/.test(resetUrl.slice(PASSWORD_RESET_URL_PREFIX.length))) throw new Error('Invalid reset URL.');
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() || expiresAt.getTime() > Date.now() + 65 * 60 * 1000) throw new Error('Invalid reset expiry.');
    return;
  }
  if (payload.schemaVersion !== 2) {
    throw new Error('Unsupported schema version.');
  }
  if (payload.eventType === 'booking.reconciliation') {
    if (!Array.isArray(payload.canonicalBookings) || payload.canonicalBookings.length > 5000) throw new Error('Invalid reconciliation payload.');
    payload.canonicalBookings.forEach(function (booking) {
      if (!String(booking.id || '').trim() || !Number.isInteger(Number(booking.version))) throw new Error('Invalid reconciliation booking.');
    });
    return;
  }
  [
    ['idempotencyKey', payload.idempotencyKey],
    ['booking.id', payload.booking && payload.booking.id],
    ['booking.memberId', payload.booking && payload.booking.memberId],
    ['booking.eventId', payload.booking && payload.booking.eventId],
    ['member.email', payload.member && payload.member.email],
    ['event.title', payload.event && payload.event.title],
  ].forEach(function (entry) {
    if (!String(entry[1] || '').trim()) {
      throw new Error(entry[0] + ' is required.');
    }
  });
  if (!['registered', 'cancelled'].includes(payload.operational.status)) {
    throw new Error('Unsupported booking status.');
  }
  if (!Number.isInteger(Number(payload.booking.version))) {
    throw new Error('A numeric booking version is required.');
  }
}

function sendPasswordResetEmail_(payload) {
  const safeName = htmlEscape_(payload.displayName);
  const safeUrl = htmlEscape_(payload.resetUrl);
  const subject = 'Reset your Jaguar Golf Society password';
  const body = 'Hello ' + payload.displayName + ',\n\nUse this one-time link within 60 minutes to reset your Jaguar Golf Society password:\n\n' + payload.resetUrl + '\n\nIf you did not request this, you can ignore this email.';
  const htmlBody = '<p>Hello ' + safeName + ',</p>'
    + '<p>Use this one-time link within 60 minutes to reset your Jaguar Golf Society password:</p>'
    + '<p><a href="' + safeUrl + '">Reset my password</a></p>'
    + '<p>If you did not request this, you can ignore this email.</p>';
  MailApp.sendEmail({
    to: payload.recipient,
    subject: subject,
    body: body,
    htmlBody: htmlBody,
    name: 'Jaguar Golf Society',
  });
}

function htmlEscape_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function upsertBooking_(sheet, payload) {
  const headers = headerMap_(sheet, HEADER_ROW);
  const requiredHeaders = [
    'booking_id',
    'event_id',
    'member_id',
    'member_email',
    'member_name',
    'booking_status',
    'buggy_required',
    'dietary_requirements',
    'registered_at',
    'cancelled_at',
    'updated_at',
    'idempotency_key',
    'sync_status',
    'sync_error',
    'event_name',
    'event_date',
    'venue',
    'source_row_id',
    'version',
  ];
  requiredHeaders.forEach(function (header) {
    if (!headers[header]) throw new Error('Missing Bookings column: ' + header);
  });

  const firstDataRow = HEADER_ROW + 1;
  const lastRow = Math.max(sheet.getLastRow(), firstDataRow);
  const lastColumn = sheet.getLastColumn();
  const rowCount = Math.max(0, lastRow - firstDataRow + 1);
  const values = rowCount
    ? sheet.getRange(firstDataRow, 1, rowCount, lastColumn).getValues()
    : [];
  let targetRow = 0;
  let existingVersion = 0;
  let existingKey = '';

  values.some(function (row, index) {
    if (
      String(row[headers.event_id - 1]) === String(payload.booking.eventId)
      && String(row[headers.member_id - 1]) === String(payload.booking.memberId)
    ) {
      targetRow = firstDataRow + index;
      existingVersion = Number(row[headers.version - 1] || 0);
      existingKey = String(row[headers.idempotency_key - 1] || '');
      return true;
    }
    return false;
  });

  const duplicate = existingKey === payload.idempotencyKey;
  if (targetRow && existingVersion > Number(payload.booking.version)) {
    return { duplicate: false, stale: true, row: targetRow };
  }
  if (targetRow && existingVersion === Number(payload.booking.version) && !duplicate) {
    throw new Error('Conflicting booking version.');
  }
  if (!targetRow) targetRow = Math.max(sheet.getLastRow() + 1, firstDataRow);

  const status = payload.operational.status === 'registered'
    ? 'Registered'
    : 'Cancelled';
  const rowValues = new Array(lastColumn).fill('');
  set_(rowValues, headers, 'booking_id', payload.booking.id);
  set_(rowValues, headers, 'event_id', payload.booking.eventId);
  set_(rowValues, headers, 'member_id', payload.booking.memberId);
  set_(rowValues, headers, 'member_email', payload.member.email);
  set_(rowValues, headers, 'member_name', payload.member.displayName || '');
  set_(rowValues, headers, 'booking_status', status);
  set_(
    rowValues,
    headers,
    'buggy_required',
    payload.operational.buggyRequired ? 'Yes' : 'No',
  );
  set_(
    rowValues,
    headers,
    'dietary_requirements',
    payload.operational.dietaryRequirements || '',
  );
  set_(rowValues, headers, 'registered_at', dateOrBlank_(payload.booking.registeredAt));
  set_(rowValues, headers, 'cancelled_at', dateOrBlank_(payload.booking.cancelledAt));
  set_(rowValues, headers, 'updated_at', dateOrBlank_(payload.booking.updatedAt));
  set_(rowValues, headers, 'idempotency_key', payload.idempotencyKey);
  set_(rowValues, headers, 'sync_status', 'Synced');
  set_(rowValues, headers, 'sync_error', '');
  set_(rowValues, headers, 'event_name', payload.event.title);
  set_(rowValues, headers, 'event_date', dateOrBlank_(payload.event.date));
  set_(rowValues, headers, 'venue', payload.event.venue || '');
  set_(rowValues, headers, 'source_row_id', targetRow);
  set_(rowValues, headers, 'version', Number(payload.booking.version));

  if (targetRow <= sheet.getLastRow()) {
    requiredHeaders.forEach(function (header) {
      if (sheet.getRange(targetRow, headers[header]).getFormula()) throw new Error('Formula collision in managed booking column: ' + header);
    });
    requiredHeaders.forEach(function (header) {
      sheet.getRange(targetRow, headers[header]).setValue(rowValues[headers[header] - 1]);
    });
  } else {
    sheet.getRange(targetRow, 1, 1, lastColumn).setValues([rowValues]);
  }
  return { duplicate: duplicate, stale: false, row: targetRow };
}

function auditBookingOutput_(bookingSheet, logSheet, payload, startedAt) {
  const headers = headerMap_(bookingSheet, HEADER_ROW);
  const expected = {};
  payload.canonicalBookings.forEach(function (booking) { expected[String(booking.id)] = Number(booking.version); });
  const rowCount = Math.max(0, bookingSheet.getLastRow() - HEADER_ROW);
  if (!rowCount) return 0;
  const values = bookingSheet.getRange(HEADER_ROW + 1, 1, rowCount, bookingSheet.getLastColumn()).getValues();
  let flagged = 0;
  values.forEach(function (row, index) {
    const bookingId = String(row[headers.booking_id - 1] || '').trim();
    if (!bookingId) return;
    const sheetVersion = Number(row[headers.version - 1] || 0);
    let issue = '';
    if (!Object.prototype.hasOwnProperty.call(expected, bookingId)) issue = 'Orphaned sheet row requires human review.';
    else if (sheetVersion !== expected[bookingId]) issue = 'Conflicting booking version requires human review.';
    if (issue) {
      appendSyncLog_(logSheet, { idempotencyKey: payload.idempotencyKey + ':row:' + (HEADER_ROW + 1 + index) }, 'Failed', startedAt, issue);
      flagged += 1;
    }
  });
  if (!flagged) appendSyncLog_(logSheet, payload, 'Succeeded', startedAt, '');
  return flagged;
}
function appendSyncLog_(sheet, payload, status, startedAt, errorMessage) {
  const headers = headerMap_(sheet, HEADER_ROW);
  const key = String(payload.idempotencyKey || '');
  if (key && sheet.getLastRow() > HEADER_ROW) {
    const keys = sheet.getRange(HEADER_ROW + 1, headers.run_id, sheet.getLastRow() - HEADER_ROW, 1).getValues();
    if (keys.some(function (row) { return String(row[0]) === key; })) return;
  }
  const lastColumn = sheet.getLastColumn();
  const rowValues = new Array(lastColumn).fill('');
  const now = new Date();
  set_(
    rowValues,
    headers,
    'run_id',
    payload.idempotencyKey || Utilities.getUuid(),
  );
  set_(rowValues, headers, 'sync_type', 'Bookings');
  set_(rowValues, headers, 'status', status);
  set_(rowValues, headers, 'started_at', startedAt);
  set_(rowValues, headers, 'completed_at', now);
  set_(rowValues, headers, 'records_processed', status === 'Succeeded' ? 1 : 0);
  set_(rowValues, headers, 'error_message', errorMessage || '');
  set_(rowValues, headers, 'triggered_by', 'Website');
  sheet.appendRow(rowValues);
}

function headerMap_(sheet, rowNumber) {
  const values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  return values.reduce(function (result, value, index) {
    const key = String(value || '').trim().toLowerCase();
    if (key) result[key] = index + 1;
    return result;
  }, {});
}

function requiredSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('Missing required sheet: ' + name);
  return sheet;
}

function set_(row, headers, key, value) {
  if (headers[key]) row[headers[key] - 1] = value;
}

function dateOrBlank_(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) throw new Error('Invalid date value.');
  return parsed;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
