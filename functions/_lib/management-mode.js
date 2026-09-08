export async function websiteManaged(db) {
  try {
    const row=await db.prepare("SELECT value FROM management_settings WHERE key='mode'").first();
    return row?.value==='website';
  } catch(error) {
    if (/no such table: management_settings/.test(String(error?.message))) return false;
    throw error;
  }
}
