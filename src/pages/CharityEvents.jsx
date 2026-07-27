import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { api } from '../lib/api';

export default function CharityEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.get('/api/events');
      setEvents(result.events);
    } catch (loadError) {
      setError(loadError.message || 'Fixtures could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-2xl bg-jaguar-green px-6 py-8 text-white shadow-lg sm:px-9">
          <span className="text-xs font-black uppercase tracking-[0.24em] text-trophy-gold">
            Member fixtures
          </span>
          <h1 className="mt-3 text-4xl font-serif font-black sm:text-5xl">
            Book your next round
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-white/80">
            View event details, register yourself and manage your booking in one place.
          </p>
        </header>

        {loading && <FixturesLoading />}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center" role="alert">
            <span className="material-symbols-outlined text-4xl text-charity-crimson">error</span>
            <h2 className="mt-2 text-xl font-bold text-midnight-navy">Fixtures are temporarily unavailable</h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <button
              type="button"
              onClick={loadEvents}
              className="mt-5 min-h-11 rounded-lg bg-jaguar-green px-5 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jaguar-green"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="rounded-xl border border-border-light bg-white p-8 text-center shadow-sm">
            <span className="material-symbols-outlined text-5xl text-trophy-gold">event_busy</span>
            <h2 className="mt-3 text-2xl font-serif font-bold text-midnight-navy">No published fixtures yet</h2>
            <p className="mt-2 text-gray-600">New events will appear here when the committee publishes them.</p>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <section aria-labelledby="fixtures-heading">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-trophy-gold">
                  2026 season
                </p>
                <h2 id="fixtures-heading" className="mt-1 text-3xl font-serif font-black text-midnight-navy">
                  Available fixtures
                </h2>
              </div>
              <span className="rounded-full bg-jaguar-green/10 px-3 py-1 text-xs font-bold text-jaguar-green">
                {events.length} event{events.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {events.map((event) => <FixtureCard event={event} key={event.id} />)}
            </div>
          </section>
        )}
      </div>
    </MainLayout>
  );
}

function FixtureCard({ event }) {
  const date = new Date(`${event.eventDate}T12:00:00Z`);
  const bookingActive = event.booking?.status === 'registered';
  const action = actionFor(event, bookingActive);
  const deadline = event.registrationClosesAt
    ? formatDateTime(event.registrationClosesAt, event.timezone)
    : 'Awaiting committee confirmation';

  return (
    <article className="group flex min-h-full flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-center gap-4 border-b border-border-light bg-surface-light px-5 py-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-midnight-navy text-center text-white shadow">
          <span className="text-[10px] font-black uppercase tracking-wider text-trophy-gold">
            {date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}
          </span>
          <span className="text-2xl font-serif font-black leading-none">
            {date.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'UTC' })}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', timeZone: 'UTC' })}
          </p>
          <h3 className="mt-1 text-xl font-serif font-black text-midnight-navy">
            {event.title}
          </h3>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <dl className="space-y-3 text-sm">
          <Detail icon="location_on" label="Venue" value={event.venue} />
          <Detail icon="payments" label="Cost" value={event.cost || 'To be confirmed'} />
          <Detail icon="event_available" label="Registration deadline" value={deadline} />
        </dl>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-light pt-4">
          <StatusBadge active={bookingActive} availability={event.availability} />
          <Link
            to={`/events/${encodeURIComponent(event.id)}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-jaguar-green px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-green-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jaguar-green"
            aria-label={`${action} for ${event.title}`}
          >
            {action}
            <span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

function Detail({ icon, label, value }) {
  return (
    <div className="flex gap-3">
      <span className="material-symbols-outlined mt-0.5 text-lg text-jaguar-green" aria-hidden="true">{icon}</span>
      <div>
        <dt className="text-[10px] font-black uppercase tracking-wider text-gray-400">{label}</dt>
        <dd className="mt-0.5 font-semibold text-midnight-navy">{value}</dd>
      </div>
    </div>
  );
}

function StatusBadge({ active, availability }) {
  const label = active
    ? 'Confirmed'
    : availability.registration === 'open'
      ? 'Registration open'
      : availability.registration === 'upcoming'
        ? 'Opens soon'
        : 'Registration closed';
  const icon = active ? 'check_circle' : availability.registration === 'open' ? 'how_to_reg' : 'schedule';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${
      active
        ? 'bg-green-100 text-green-800'
        : availability.registration === 'open'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-gray-100 text-gray-700'
    }`}>
      <span className="material-symbols-outlined text-base" aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

function actionFor(event, bookingActive) {
  if (bookingActive) return 'Manage booking';
  if (event.availability.registration === 'open') return 'View and register';
  return 'View details';
}

function formatDateTime(value, timezone) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || 'Europe/London',
  }).format(new Date(value));
}

function FixturesLoading() {
  return (
    <div className="grid gap-5 md:grid-cols-2" aria-busy="true" aria-label="Loading fixtures">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-72 animate-pulse rounded-2xl border border-border-light bg-gray-100" />
      ))}
    </div>
  );
}

