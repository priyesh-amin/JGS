import { AppError } from '../errors.js';

export const financeDate = now => new Intl.DateTimeFormat('en-CA', {
  timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',
}).format(now);

export function bookingFinanceError(error) {
  const message=String(error?.message || error);
  if(message.includes('finance_historical_booking_review')) return new AppError(409,'historical_booking_review','Chetan needs to check whether this previous booking is already covered by your opening balance before it can be booked again.');
  if(message.includes('finance_booking_fee_missing')) return new AppError(409,'booking_fee_unavailable','The event fee needs checking before this booking can be confirmed. Ask Chetan to set a price, including 0 for a free event.');
  if(message.includes('finance_booking_cutoff')) return new AppError(409,'booking_opening_cutoff','The account opening cutoff includes this booking date. Ask Chetan to check the opening balance before booking.');
  if(message.includes('finance_booking_due_invalid')) return new AppError(409,'booking_due_unavailable','The event payment due date needs checking before booking.');
  return error;
}
