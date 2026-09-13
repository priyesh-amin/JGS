import { dateKey } from './account.js';

// Deliberately synthetic contract: NOT a validated adapter for Chetan's bank.
export const SYNTHETIC_COLUMNS = ['account', 'transaction_id', 'date', 'amount', 'currency', 'reference'];

export function amountPence(value) {
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Invalid decimal amount.');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('Amount exceeds safe integer range.');
  return negative ? -result : result;
}

// Strict CSV parsing preserves source cells and rejects broken quote/row structure.
export function readCsv(text) {
  if (typeof text !== 'string' || text.length > 2_000_000) throw new Error('CSV missing or too large.');
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', state = 'start';
  const endCell = () => { row.push(cell); cell = ''; state = 'start'; };
  const endRow = () => { endCell(); if (row.some((value) => value !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (state === 'quoted') {
      if (char === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; } else state = 'closed';
      } else cell += char;
    } else if (char === ',') endCell();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      endRow();
    } else if (char === '"' && state === 'start') state = 'quoted';
    else {
      if (char === '"' || state === 'closed') throw new Error('Malformed CSV quoting.');
      cell += char; state = 'unquoted';
    }
  }
  if (state === 'quoted') throw new Error('Unterminated CSV quote.');
  if (cell || row.length || state === 'closed') endRow();
  return rows;
}

const identity = (row) => JSON.stringify([row.account, row.transactionId]);
const evidence = (row) => JSON.stringify([row.date, row.amountPence, row.currency, row.reference]);
const referenceKey = (value) => String(value ?? '').trim().toUpperCase();

export function previewSyntheticImport({ csv, account, coverageFrom, coverageThrough, existing = [], members = [] }) {
  if (typeof account !== 'string' || !account.trim()) throw new Error('Expected account required.');
  dateKey(coverageFrom); dateKey(coverageThrough);
  if (coverageFrom > coverageThrough) throw new Error('Invalid coverage period.');
  const [headers, ...sourceRows] = readCsv(csv);
  if (JSON.stringify(headers) !== JSON.stringify(SYNTHETIC_COLUMNS) || !sourceRows.length) throw new Error('Unsupported or empty synthetic CSV.');
  const rows = sourceRows.map((source, index) => {
    if (source.length !== headers.length) throw new Error(`Invalid column count at row ${index + 2}.`);
    const [bankAccount, transactionId, date, amount, currency, reference] = source;
    if (bankAccount !== account || currency !== 'GBP' || !transactionId.trim()) throw new Error(`Invalid account, currency or ID at row ${index + 2}.`);
    dateKey(date);
    if (date < coverageFrom || date > coverageThrough) throw new Error('Transaction outside supplied coverage.');
    const value = amountPence(amount);
    if (value === 0) throw new Error('Zero-value movement requires a bank-specific rule.');
    return { account, transactionId, date, amountPence: value, currency, reference, source: [...source], sourceRow: index + 2 };
  });
  const known = new Map();
  const conflicts = new Set();
  for (const row of [...existing, ...rows]) {
    const key = identity(row);
    if (known.has(key) && evidence(known.get(key)) !== evidence(row)) conflicts.add(key);
    else known.set(key, row);
  }
  const seen = new Set(existing.map(identity));
  const output = rows.map((row) => {
    const key = identity(row);
    let status, suggestedMemberId = null;
    if (conflicts.has(key)) status = 'conflict';
    else if (seen.has(key)) status = 'duplicate';
    else if (row.amountPence < 0) status = 'non_member_review';
    else {
      const matches = members.filter((member) => member.id && referenceKey(member.paymentReference)
        && referenceKey(member.paymentReference) === referenceKey(row.reference));
      if (matches.length === 1) { status = 'suggested'; suggestedMemberId = matches[0].id; }
      else status = 'unassigned';
    }
    seen.add(key);
    return { ...row, status, suggestedMemberId };
  });
  const summary = {};
  for (const row of output) {
    const group = summary[row.status] ||= { count: 0, amountPence: 0 };
    group.count += 1;
    group.amountPence += row.amountPence;
    if (!Number.isSafeInteger(group.amountPence)) throw new Error('Import total exceeds safe integer range.');
  }
  return { mode: 'synthetic-preview', rows: output, summary, coverageFrom, coverageThrough,
    coverageVerified: false, reconciledThrough: null, postedCount: 0 };
}
