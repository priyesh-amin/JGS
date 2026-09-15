import test from 'node:test';
import assert from 'node:assert/strict';
import { accountStatement, dateKey } from '../functions/_lib/reconciliation/account.js';
import { amountPence, readCsv, previewSyntheticImport, SYNTHETIC_COLUMNS } from '../functions/_lib/reconciliation/import-preview.js';

const member = { id: 'member-1', paymentReference: 'JGS-0042' };
const charge = { id: 'charge-1', memberId: member.id, status: 'posted', amountPence: 6500, dueOn: '2026-09-13' };
const fund = (amountPence) => ({ id: 'fund-1', memberId: member.id, status: 'posted', amountPence });
const allocation = (amountPence) => ({ id: 'allocation-1', chargeId: charge.id, fundId: 'fund-1', amountPence });
const statement = (overrides = {}) => accountStatement({ memberId: member.id, charges: [charge], funds: [fund(2000)], allocations: [allocation(2000)], asOf: '2026-09-13', ...overrides });
const row = (id = 'bank-1', amount = '45.00', reference = 'JGS-0042') => `society,${id},2026-09-12,${amount},GBP,${reference}`;
const preview = (rows, overrides = {}) => previewSyntheticImport({ csv: [SYNTHETIC_COLUMNS.join(','), ...rows].join('\n'), account: 'society', coverageFrom: '2026-09-01', coverageThrough: '2026-09-13', members: [member], ...overrides });

test('£20 credit allocated to £65 charge leaves £45 due', () => {
  assert.equal(statement().dueNowPence, 4500);
  assert.equal(statement().availableCreditPence, 0);
});
test('partial payment and overpayment preserve exact balances', () => {
  assert.equal(statement({ funds: [fund(4000)], allocations: [allocation(4000)] }).dueNowPence, 2500);
  const result = statement({ funds: [fund(8000)], allocations: [allocation(6500)] });
  assert.equal(result.dueNowPence, 0); assert.equal(result.availableCreditPence, 1500);
});
test('future charges are upcoming, never overdue', () => {
  const result = statement({ asOf: '2026-09-01' });
  assert.equal(result.dueNowPence, 0); assert.equal(result.upcomingPence, 4500);
});
test('no allocation policy is silently chosen', () => {
  const result = statement({ allocations: [] });
  assert.equal(result.dueNowPence, 6500); assert.equal(result.availableCreditPence, 2000);
});
test('reject cross-member entries and unverified claims', () => {
  assert.throws(() => statement({ funds: [{ ...fund(2000), memberId: 'other' }] }));
  assert.throws(() => statement({ funds: [{ ...fund(2000), status: 'pending' }] }));
});
test('reject double spending, unknown links and duplicate record IDs', () => {
  assert.throws(() => statement({ allocations: [allocation(2001)] }));
  assert.throws(() => statement({ allocations: [allocation(2000), { ...allocation(1), id: 'second' }] }));
  assert.throws(() => statement({ allocations: [{ ...allocation(1), fundId: 'unknown' }] }));
  assert.throws(() => statement({ charges: [charge, charge] }));
});
test('reject invalid dates, fractional pence and aggregate overflow', () => {
  for (const value of ['2026-02-30', '13/09/2026', 'invalid']) assert.throws(() => dateKey(value));
  assert.throws(() => statement({ funds: [fund(1.5)] }));
  assert.throws(() => statement({ funds: [fund(Number.MAX_SAFE_INTEGER), { ...fund(1), id: 'second' }], allocations: [] }));
});
test('decimal conversion is exact and rejects malformed amounts', () => {
  assert.equal(amountPence('0.29'), 29); assert.equal(amountPence('-65.10'), -6510);
  for (const value of ['1e2', '£45', '1,000', '1.001', '', '9007199254740992']) assert.throws(() => amountPence(value));
});
test('CSV accepts BOM, CRLF, quoted commas, quotes and newlines', () => {
  assert.deepEqual(readCsv('\uFEFFa,b\r\n"x,y","z""q\nnext"\r\n'), [['a', 'b'], ['x,y', 'z"q\nnext']]);
  for (const value of ['a,"broken', 'a,b"c', 'a,"b"c']) assert.throws(() => readCsv(value));
});
test('preview suggests exact reference only and never posts', () => {
  const result = preview([row()]);
  assert.equal(result.rows[0].suggestedMemberId, member.id);
  assert.equal(result.postedCount, 0); assert.equal(result.reconciledThrough, null);
  assert.equal(result.coverageVerified, false);
});
test('overlapping exports and repeat rows are duplicates', () => {
  const first = preview([row()]);
  assert.equal(preview([row()], { existing: first.rows }).rows[0].status, 'duplicate');
  assert.deepEqual(preview([row(), row()]).rows.map((item) => item.status), ['suggested', 'duplicate']);
});
test('distinct IDs retain legitimate identical payments', () => {
  assert.equal(preview([row('one'), row('two')]).summary.suggested.count, 2);
});
test('changed evidence quarantines all occurrences of conflicting ID', () => {
  assert.deepEqual(preview([row(), row('bank-1', '46.00')]).rows.map((item) => item.status), ['conflict', 'conflict']);
  const existing = preview([row()]).rows;
  assert.equal(preview([row('bank-1', '46.00')], { existing }).rows[0].status, 'conflict');
});
test('account scope prevents false duplicate matches', () => {
  const existing = preview([row()]).rows.map((item) => ({ ...item, account: 'other-account' }));
  assert.equal(preview([row()], { existing }).rows[0].status, 'suggested');
});
test('unknown, duplicate and blank member references stay unassigned', () => {
  assert.equal(preview([row('one', '45', 'John Smith')]).rows[0].status, 'unassigned');
  assert.equal(preview([row()], { members: [member, { ...member, id: 'other' }] }).rows[0].status, 'unassigned');
  assert.equal(preview([row('one', '45', '')], { members: [{ id: 'other', paymentReference: '' }] }).rows[0].status, 'unassigned');
});
test('outgoing money is reviewed outside member receipts', () => {
  const result = preview([row('one', '-65')]);
  assert.equal(result.rows[0].status, 'non_member_review');
  assert.equal(result.rows[0].suggestedMemberId, null);
});
test('bad format, missing ID, currency, account and coverage fail the whole preview', () => {
  for (const bad of [row().replace('GBP', 'USD'), row().replace('society', 'other'), row(''), `${row()},extra`, row().replace('2026-09-12', '2026-08-31')]) {
    assert.throws(() => preview([row('valid'), bad]));
  }
  assert.throws(() => preview([]));
  assert.throws(() => preview([row()], { coverageThrough: '2026-08-01' }));
});
test('preview preserves input data without mutation', () => {
  const existing = preview([row()]).rows;
  const before = JSON.stringify(existing);
  preview([row(), row('second')], { existing });
  assert.equal(JSON.stringify(existing), before);
});
