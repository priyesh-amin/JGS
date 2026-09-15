import { amountPence, readCsv } from './import-preview.js';
import { dateKey } from './account.js';

export const BANK_COLUMNS = ['Number', 'Date', 'Account', 'Amount', 'Subcategory', 'Memo'];
export const clean = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
function bankDate(value) {
  const text = clean(value);
  const uk = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = uk ? `${uk[3]}-${uk[2]}-${uk[1]}` : text.replace(/[ T]00:00:00$/, '');
  return dateKey(iso);
}

// Number is NOT an immutable ID in this export: most sample values are zero.
// Fingerprints identify possible duplicates, never prove transaction identity.
export async function parseBank({ csv, rows, coverageFrom, coverageThrough }) {
  dateKey(coverageFrom); dateKey(coverageThrough);
  if (coverageFrom > coverageThrough) throw new Error('Coverage start must precede end.');
  const table = rows ?? readCsv(csv);
  if (!Array.isArray(table) || table.length < 2 || table.length > 2001) throw new Error('Upload 1–2000 bank transactions.');
  if (JSON.stringify(table[0].map(clean)) !== JSON.stringify(BANK_COLUMNS)) throw new Error('Expected Number, Date, Account, Amount, Subcategory, Memo columns only.');
  const parsed = [];
  for (const [index, source] of table.slice(1).entries()) {
    if (!Array.isArray(source) || source.length > 6) throw new Error(`Invalid columns at row ${index + 2}.`);
    if (source.every(v => !clean(v))) continue;
    const raw = Array.from({ length: 6 }, (_, i) => String(source[i] ?? ''));
    if (raw.some(v => v.length > 2000)) throw new Error('Bank cell exceeds 2000 characters.');
    const [number, date, account, amount, subcategory, memo] = raw.map(clean);
    const postedOn = bankDate(date), value = amountPence(amount);
    if (!account || !memo || !subcategory || value === 0 || Math.abs(value) > 100000000) throw new Error(`Invalid bank movement at row ${index + 2}.`);
    if (postedOn < coverageFrom || postedOn > coverageThrough) throw new Error('Transaction outside declared export coverage.');
    const fingerprint = await digest(JSON.stringify([number, postedOn, account, value, subcategory, memo]));
    parsed.push({ number, postedOn, account, amountPence: value, subcategory, memo, raw, fingerprint, sourceRow: index + 2 });
  }
  if (!parsed.length || new Set(parsed.map(r => r.account)).size !== 1) throw new Error('Upload a non-empty export for one bank account.');
  return { rows: parsed, account: parsed[0].account, coverageFrom, coverageThrough,
    id: await digest(JSON.stringify(parsed.map(r => r.fingerprint).sort())) };
}

export function suggestMember(memo, members) {
  const words = value => ` ${clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
  const content = words(memo);
  const matches = members.filter(m => {
    const name = words(m.display_name);
    return name.trim().split(' ').length >= 2 && content.includes(name);
  });
  return matches.length === 1 ? matches[0].id : null;
}
