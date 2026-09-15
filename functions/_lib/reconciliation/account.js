// Pure account calculations. No database writes or implicit allocation policy.
export function pence(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Expected non-negative safe integer pence.');
  return value;
}

export function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new Error('Expected a valid ISO calendar date.');
  }
  return value;
}

function unique(items) {
  const result = new Map();
  for (const item of items) {
    if (typeof item.id !== 'string' || !item.id.trim() || result.has(item.id)) throw new Error('Missing or duplicate record ID.');
    result.set(item.id, item);
  }
  return result;
}

function sum(values) {
  return values.reduce((total, value) => pence(total + pence(value)), 0);
}

// Inputs are posted, effective charges and confirmed funds, not payment claims.
// Reversals/credits must first be projected by a future persisted journal adapter.
export function accountStatement({ memberId, charges = [], funds = [], allocations = [], asOf }) {
  if (typeof memberId !== 'string' || !memberId.trim()) throw new Error('Member ID required.');
  dateKey(asOf);
  const chargeMap = unique(charges);
  const fundMap = unique(funds);
  unique(allocations);
  for (const item of [...charges, ...funds]) {
    if (item.memberId !== memberId || item.status !== 'posted') throw new Error('Only this member’s posted entries are allowed.');
    pence(item.amountPence);
  }
  charges.forEach((charge) => dateKey(charge.dueOn));
  const usedCharges = new Map();
  const usedFunds = new Map();
  for (const allocation of allocations) {
    const charge = chargeMap.get(allocation.chargeId);
    const fund = fundMap.get(allocation.fundId);
    if (!charge || !fund || pence(allocation.amountPence) === 0) throw new Error('Invalid allocation.');
    const chargeUsed = pence((usedCharges.get(charge.id) || 0) + allocation.amountPence);
    const fundUsed = pence((usedFunds.get(fund.id) || 0) + allocation.amountPence);
    if (chargeUsed > charge.amountPence || fundUsed > fund.amountPence) throw new Error('Allocation exceeds charge or funds.');
    usedCharges.set(charge.id, chargeUsed);
    usedFunds.set(fund.id, fundUsed);
  }
  const lines = charges.map((charge) => ({
    ...charge,
    allocatedPence: usedCharges.get(charge.id) || 0,
    outstandingPence: charge.amountPence - (usedCharges.get(charge.id) || 0),
  }));
  return {
    memberId, currency: 'GBP', asOf, charges: lines,
    dueNowPence: sum(lines.filter((line) => line.dueOn <= asOf).map((line) => line.outstandingPence)),
    upcomingPence: sum(lines.filter((line) => line.dueOn > asOf).map((line) => line.outstandingPence)),
    availableCreditPence: sum(funds.map((fund) => fund.amountPence - (usedFunds.get(fund.id) || 0))),
  };
}
