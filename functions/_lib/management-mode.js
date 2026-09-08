export async function websiteManaged(db) {
  const row = await db.prepare("SELECT value FROM management_settings WHERE key = 'mode'").first();
  return row?.value === 'website';
}
