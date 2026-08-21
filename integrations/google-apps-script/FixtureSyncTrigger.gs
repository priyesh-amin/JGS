const FIXTURE_SHEET_NAME = 'DB_Fixtures';
const SYNC_HANDLER = 'notifyFixtureSyncOnEdit';

function notifyFixtureSyncOnEdit(event) {
  if (!event || event.range.getSheet().getName() !== FIXTURE_SHEET_NAME) {
    return;
  }
  requestFixtureSync_();
}

function installFixtureSyncTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function (trigger) {
      return trigger.getHandlerFunction() === SYNC_HANDLER;
    })
    .forEach(function (trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger(SYNC_HANDLER)
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
}

function testFixtureSync() {
  requestFixtureSync_();
}

function requestFixtureSync_() {
  const properties = PropertiesService.getScriptProperties();
  const endpoint = properties.getProperty('CLOUDFLARE_FIXTURE_SYNC_URL');
  const token = properties.getProperty('FIXTURE_SYNC_TOKEN');
  if (!endpoint || !token) {
    throw new Error(
      'Set CLOUDFLARE_FIXTURE_SYNC_URL and FIXTURE_SYNC_TOKEN in Script properties.',
    );
  }

  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
    },
    // This body is only a notification. Cloudflare ignores it and always
    // re-reads the approved canonical CSV before changing fixture data.
    payload: JSON.stringify({
      schemaVersion: 1,
      type: 'fixture_refresh_requested',
    }),
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  let result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error('Cloudflare returned a non-JSON response (HTTP ' + status + ').');
  }
  if (status < 200 || status >= 300 || result.ok !== true) {
    throw new Error(
      'Fixture synchronisation was rejected (HTTP ' + status + ').',
    );
  }
  return result;
}
