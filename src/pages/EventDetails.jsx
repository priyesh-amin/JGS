import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { api } from '../lib/api';
import { useAuth } from '../contexts/useAuth';

export default function EventDetails() {
  const { eventId } = useParams();
  const { isAdmin } = useAuth();
  const [event, setEvent] = useState(null);
  const [balance, setBalance] = useState(null);
  const [balanceError, setBalanceError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadSupplemental = useCallback(async () => {
    const balanceResult = await api.get('/api/account/balance')
      .then((result) => ({ result, error: '' }))
      .catch((balanceLoadError) => ({
        result: null,
        error: balanceLoadError.message || 'Your balance is unavailable.',
      }));
    setBalance(balanceResult.result);
    setBalanceError(balanceResult.error);
  }, []);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get(`/api/events/${encodeURIComponent(eventId)}`);
      setEvent(result.event);
      await loadSupplemental();
    } catch (loadError) {
      setError(loadError.message || 'The event could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [eventId, loadSupplemental]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-5xl">
        <Link
          to="/events"
          className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-jaguar-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-jaguar-green"
        >
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          Back to fixtures
        </Link>

        {loading && <div className="h-96 animate-pulse rounded-2xl bg-gray-100" aria-busy="true" />}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6" role="alert">
            <h1 className="text-2xl font-serif font-bold text-midnight-navy">Event unavailable</h1>
            <p className="mt-2 text-gray-700">{error}</p>
            <button type="button" onClick={loadEvent} className="mt-4 min-h-11 rounded-lg bg-jaguar-green px-5 py-3 font-bold text-white">Try again</button>
          </div>
        )}

        {event && (
          <>
            {notice && (
              <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900 shadow-sm" aria-live="polite" role="status">
                <span className="material-symbols-outlined text-green-700" aria-hidden="true">check_circle</span>
                <div>
                  <p className="font-black">Booking updated</p>
                  <p className="mt-0.5 text-sm">{notice}</p>
                </div>
              </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <EventInformation event={event} />
              <BookingPanel
                event={event}
                isAdmin={isAdmin}
                onChanged={(nextEvent, message) => {
                  setEvent(nextEvent);
                  setNotice(message);
                  loadSupplemental().catch(() => {});
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
              <AttendancePanel attendeeCount={event.attendeeCount} />
              <PaymentPanel
                event={event}
                balance={balance}
                error={balanceError}
              />
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}

function EventInformation({ event }) {
  const date = new Date(`${event.eventDate}T12:00:00Z`);
  return (
    <article className="overflow-hidden rounded-2xl border border-border-light bg-white shadow-lg">
      <header className="bg-midnight-navy px-6 py-7 text-white sm:px-8">
        <span className="text-xs font-black uppercase tracking-[0.22em] text-trophy-gold">
          {date.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </span>
        <h1 className="mt-3 text-4xl font-serif font-black">{event.title}</h1>
        <p className="mt-3 flex items-center gap-2 text-white/80">
          <span className="material-symbols-outlined text-trophy-gold" aria-hidden="true">location_on</span>
          {event.venue}
        </p>
      </header>
      <div className="space-y-7 p-6 sm:p-8">
        <section aria-labelledby="event-details-heading">
          <h2 id="event-details-heading" className="text-2xl font-serif font-black text-midnight-navy">Event details</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Info label="Meet time" value={event.meetTime || 'To be confirmed'} />
            <Info label="First tee time" value={event.teeTime || 'To be confirmed'} />
            <Info label="Cost" value={event.cost || 'To be confirmed'} />
            <Info
              label="Registration closes"
              value={event.registrationClosesAt
                ? formatDateTime(event.registrationClosesAt, event.timezone)
                : 'Awaiting committee confirmation'}
            />
            <Info
              label="Cancellation closes"
              value={event.cancellationClosesAt
                ? formatDateTime(event.cancellationClosesAt, event.timezone)
                : 'Cancellation is not configured'}
            />
            <Info label="Timezone" value={event.timezone} />
          </dl>
        </section>
        {event.description && (
          <section>
            <h2 className="text-xl font-serif font-bold text-midnight-navy">About this fixture</h2>
            <p className="mt-2 whitespace-pre-line leading-7 text-gray-700">{event.description}</p>
          </section>
        )}
        {event.joiningInformation && (
          <section className="rounded-xl border-l-4 border-trophy-gold bg-surface-light p-5">
            <h2 className="font-bold text-midnight-navy">Joining information</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{event.joiningInformation}</p>
          </section>
        )}
      </div>
    </article>
  );
}

function BookingPanel({ event, isAdmin, onChanged }) {
  const active = event.booking?.status === 'registered';
  const [buggyRequired, setBuggyRequired] = useState(Boolean(event.booking?.buggyRequired));
  const [dietaryChoice, setDietaryChoice] = useState(active
    ? event.booking?.dietaryRequirements || ''
    : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showCancel, setShowCancel] = useState(false);

  const refresh = async (message) => {
    const result = await api.get(`/api/events/${encodeURIComponent(event.id)}`);
    onChanged(result.event, message);
  };

  const register = async (formEvent) => {
    formEvent.preventDefault();
    setError('');
    if (dietaryChoice !== 'Veg' && dietaryChoice !== 'Non-veg') {
      setError('Choose Veg or Non-veg before confirming your registration.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.post(`/api/events/${encodeURIComponent(event.id)}/booking`, {
        buggyRequired,
        dietaryRequirements: dietaryChoice,
      });
      await refresh(result.message);
    } catch (registerError) {
      setError(registerError.message || 'Registration could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await api.delete(`/api/events/${encodeURIComponent(event.id)}/booking`);
      setShowCancel(false);
      await refresh(result.message);
    } catch (cancelError) {
      setError(cancelError.message || 'Cancellation could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isAdmin) {
    return (
      <aside className="h-fit rounded-2xl border border-border-light bg-white p-6 shadow-lg">
        <span className="material-symbols-outlined text-4xl text-jaguar-green" aria-hidden="true">admin_panel_settings</span>
        <h2 className="mt-3 text-2xl font-serif font-black text-midnight-navy">Administrator view</h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Sign in with a member account to create or cancel a personal booking.
        </p>
      </aside>
    );
  }

  if (active) {
    return (
      <aside className="h-fit rounded-2xl border-2 border-green-200 bg-white p-6 shadow-lg" aria-labelledby="booking-heading">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
          <span className="material-symbols-outlined text-3xl" aria-hidden="true">check_circle</span>
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-green-700">Booking confirmed</p>
        <h2 id="booking-heading" className="mt-1 text-2xl font-serif font-black text-midnight-navy">You are registered</h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          This is your personal booking. Only you or an administrator can change it.
        </p>
        <dl className="mt-5 space-y-3 rounded-xl bg-surface-light p-4 text-sm">
          <Info label="Buggy" value={event.booking.buggyRequired ? 'Required' : 'Not required'} />
          <Info label="Dietary choice" value={event.booking.dietaryRequirements} />
          <Info label="Last updated" value={formatDateTime(event.booking.updatedAt, event.timezone)} />
        </dl>
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-charity-crimson" role="alert">{error}</p>}
        {event.availability.cancellation === 'open' ? (
          showCancel ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-bold text-midnight-navy">Cancel your booking?</p>
              <p className="mt-1 text-sm text-gray-600">Your confirmed place will be released. This action is recorded.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowCancel(false)} disabled={submitting} className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 font-bold text-midnight-navy">Keep booking</button>
                <button type="button" onClick={cancel} disabled={submitting} className="min-h-11 rounded-lg bg-charity-crimson px-3 py-2 font-bold text-white disabled:opacity-60">
                  {submitting ? 'Cancelling…' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowCancel(true)} className="mt-5 min-h-11 w-full rounded-lg border-2 border-charity-crimson px-5 py-3 font-black text-charity-crimson focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charity-crimson">
              Cancel my booking
            </button>
          )
        ) : (
          <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            Online cancellation is closed for this event. Contact the committee if exceptional help is required.
          </p>
        )}
      </aside>
    );
  }

  if (event.availability.registration !== 'open') {
    return (
      <aside className="h-fit rounded-2xl border border-border-light bg-white p-6 shadow-lg">
        <span className="material-symbols-outlined text-4xl text-trophy-gold" aria-hidden="true">schedule</span>
        <h2 className="mt-3 text-2xl font-serif font-black text-midnight-navy">
          {event.availability.registration === 'upcoming' ? 'Registration opens soon' : 'Registration unavailable'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          {availabilityMessage(event)}
        </p>
      </aside>
    );
  }

  return (
    <aside className="h-fit rounded-2xl border border-border-light bg-white p-6 shadow-lg" aria-labelledby="register-heading">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-trophy-gold">Your booking</p>
      <h2 id="register-heading" className="mt-1 text-2xl font-serif font-black text-midnight-navy">Register yourself</h2>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        Your signed-in account will be used. You cannot register another member.
      </p>
      <form onSubmit={register} className="mt-6 space-y-5">
        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-gray-300 p-4 focus-within:ring-2 focus-within:ring-jaguar-green">
          <input
            type="checkbox"
            checked={buggyRequired}
            onChange={(inputEvent) => setBuggyRequired(inputEvent.target.checked)}
            className="h-5 w-5 accent-jaguar-green"
          />
          <span>
            <span className="block font-bold text-midnight-navy">I require a buggy</span>
            <span className="block text-xs text-gray-500">Select only when needed for this event.</span>
          </span>
        </label>
        <fieldset>
          <legend className="text-sm font-bold text-midnight-navy">
            Dietary choice <span className="text-charity-crimson">(required)</span>
          </legend>
          <p id="dietary-choice-help" className="mt-1 text-xs text-gray-500">
            Choose one option before confirming your registration.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {['Veg', 'Non-veg'].map((choice) => (
              <label key={choice} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-gray-300 p-4 focus-within:ring-2 focus-within:ring-jaguar-green">
                <input
                  type="radio"
                  name="dietary-choice"
                  value={choice}
                  required
                  checked={dietaryChoice === choice}
                  onChange={(inputEvent) => setDietaryChoice(inputEvent.target.value)}
                  aria-describedby="dietary-choice-help"
                  className="h-5 w-5 accent-jaguar-green"
                />
                <span className="font-bold text-midnight-navy">{choice}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-charity-crimson" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !dietaryChoice}
          className="min-h-12 w-full rounded-lg bg-charity-crimson px-5 py-3 font-black uppercase tracking-wider text-white shadow transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-charity-crimson"
        >
          {submitting ? 'Confirming…' : 'Confirm my registration'}
        </button>
      </form>
    </aside>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</dt>
      <dd className="mt-1 font-semibold text-midnight-navy">{value}</dd>
    </div>
  );
}

function availabilityMessage(event) {
  if (event.availability.reason === 'configuration_required') {
    return 'The committee has not confirmed the online registration window yet.';
  }
  if (event.availability.registration === 'upcoming' && event.registrationOpensAt) {
    return `Registration opens ${formatDateTime(event.registrationOpensAt, event.timezone)}.`;
  }
  if (event.registrationClosesAt) {
    return `Registration closed ${formatDateTime(event.registrationClosesAt, event.timezone)}.`;
  }
  return 'Registration is not currently available.';
}

function formatDateTime(value, timezone) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || 'Europe/London',
  }).format(new Date(value));
}
function AttendancePanel({ attendeeCount }) {
  return (
    <section className="rounded-2xl border border-border-light bg-white p-6 shadow-lg" aria-labelledby="attendance-heading">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-trophy-gold">Confirmed places</p>
      <h2 id="attendance-heading" className="mt-1 text-2xl font-serif font-black text-midnight-navy">Attendance</h2>
      <p className="mt-5 text-3xl font-black text-jaguar-green">{attendeeCount || 0}</p>
      <p className="mt-2 text-sm text-gray-600">Member names and booking details are available only to administrators.</p>
    </section>
  );
}
function PaymentPanel({ event, balance, error }) {
  const allocation = balance?.allocations?.find(
    (item) => item.eventId === event.id,
  );
  const includedAtReconciliation = balance?.reconciledEventIds?.includes(
    event.id,
  );
  const covered = includedAtReconciliation
    ? balance.outstandingPence === 0
    : allocation?.isCovered;
  const hasPaymentPosition = includedAtReconciliation || allocation;

  return (
    <aside className="h-fit rounded-2xl border border-border-light bg-white p-6 shadow-lg" aria-labelledby="payment-heading">
      <span className="material-symbols-outlined text-4xl text-jaguar-green" aria-hidden="true">account_balance_wallet</span>
      <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-trophy-gold">Private to you</p>
      <h2 id="payment-heading" className="mt-1 text-2xl font-serif font-black text-midnight-navy">
        Payment and balance
      </h2>
      {hasPaymentPosition ? (
        <div className={`mt-5 rounded-xl border p-4 ${
          covered
            ? 'border-green-200 bg-green-50 text-green-900'
            : 'border-amber-200 bg-amber-50 text-amber-950'
        }`}>
          <p className="flex items-center gap-2 font-black">
            <span className="material-symbols-outlined" aria-hidden="true">
              {covered ? 'verified' : 'warning'}
            </span>
            {includedAtReconciliation
              ? covered
                ? "Included in Chetan's reconciled balance"
                : `${formatMoney(balance.outstandingPence)} outstanding on your account`
              : covered
                ? 'Covered by your reconciled balance'
                : `${formatMoney(allocation.outstandingPence)} outstanding`}
          </p>
          <p className="mt-2 text-sm leading-5">
            {includedAtReconciliation
              ? `This booking was made on or before the ${formatDateOnly(balance.reconciledOn)} reconciliation.`
              : `Only bookings after the ${formatDateOnly(balance.reconciledOn)} reconciliation are deducted. Earlier deadlines are funded first.`}
          </p>
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-surface-light p-4 text-sm font-semibold text-gray-700">
          {error || 'Coverage will appear when this event has a confirmed cost and booking.'}
        </p>
      )}
      {balance && (
        <dl className="mt-4 rounded-xl bg-surface-light p-4">
          <Info label="Reconciled balance" value={formatMoney(balance.balancePence)} />
          <Info label="Last reconciled" value={formatDateOnly(balance.reconciledOn)} />
          <Info label="After later bookings" value={formatMoney(balance.projectedBalancePence)} />
        </dl>
      )}
      <p className="mt-4 text-xs leading-5 text-gray-500">
        Other members cannot see your balance or outstanding amount.
      </p>
    </aside>
  );
}
function formatMoney(pence) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(Number(pence || 0) / 100);
}

function formatDateOnly(value) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeZone: 'Europe/London',
  }).format(new Date(`${value}T12:00:00Z`));
}
