const BOOKING_SHEET = 'Bookings';
const SYNC_LOG_SHEET = 'Sync Log';
const HEADER_ROW = 4;

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
    payload = JSON.parse(e && e.postData && e.postData.contents || '{}');
    authenticate_(payload.webhookToken);
    validatePayload_(payload);

    lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      throw new Error('The booking sheet is busy. Retry the update.');
    }

    const spreadsheet = configuredSpreadsheet_();
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
    return jsonResponse_({
      ok: false,
      error: String(error && error.message || error).slice(0, 500),
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

function authenticate_(providedToken) {
  const expectedToken = PropertiesService.getScriptProperties()
    .getProperty('BOOKING_SYNC_TOKEN');
  if (!expectedToken) {
    throw new Error('BOOKING_SYNC_TOKEN is not configured.');
  }
  if (!constantTimeEquals_(String(providedToken || ''), expectedToken)) {
    throw new Error('Unauthorised booking update.');
  }
}

function constantTimeEquals_(left, right) {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function validatePayload_(payload) {
  if (payload.schemaVersion !== 1) {
    throw new Error('Unsupported schema version.');
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

  if (existingKey === payload.idempotencyKey) {
    return { duplicate: true, stale: false, row: targetRow };
  }
  if (targetRow && existingVersion >= Number(payload.booking.version)) {
    return { duplicate: false, stale: true, row: targetRow };
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

  sheet.getRange(targetRow, 1, 1, lastColumn).setValues([rowValues]);
  return { duplicate: false, stale: false, row: targetRow };
}

function appendSyncLog_(sheet, payload, status, startedAt, errorMessage) {
  const headers = headerMap_(sheet, HEADER_ROW);
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
