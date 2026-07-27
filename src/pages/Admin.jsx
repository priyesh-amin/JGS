import { useCallback, useEffect, useId, useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import { api } from '../lib/api';

const TABS = [
  ['events', 'Events', 'event'],
  ['attendees', 'Attendees', 'groups'],
  ['members', 'Members', 'manage_accounts'],
  ['system', 'Sync status', 'sync'],
];

export default function Admin() {
  const [activeTab, setActiveTab] = useState('events');
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [memberResult, eventResult, systemResult] = await Promise.all([
        api.get('/api/admin/members'),
        api.get('/api/admin/events'),
        api.get('/api/admin/sync'),
      ]);
      setMembers(memberResult.members);
      setEvents(eventResult.events);
      setSystem(systemResult);
    } catch (loadError) {
      setError(loadError.message || 'The administrator dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const complete = async (message) => {
    setNotice(message);
    await load();
  };

  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-7xl">
        <header className="rounded-2xl bg-midnight-navy px-6 py-8 text-white shadow-lg sm:px-9">
          <span className="text-xs font-black uppercase tracking-[0.24em] text-trophy-gold">Committee controls</span>
          <h1 className="mt-3 text-4xl font-serif font-black sm:text-5xl">Event administration</h1>
          <p className="mt-3 max-w-3xl text-white/75">
            Manage member access, event windows, confirmed attendees and spreadsheet delivery from one protected area.
          </p>
        </header>

        <nav className="mt-6 grid grid-cols-2 gap-2 rounded-xl border border-border-light bg-white p-2 shadow-sm sm:grid-cols-4" aria-label="Administrator sections">
          {TABS.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jaguar-green ${
                activeTab === id ? 'bg-jaguar-green text-white' : 'text-midnight-navy hover:bg-surface-light'
              }`}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {notice && (
          <div className="mt-5 flex gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-green-900" role="status" aria-live="polite">
            <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
            {notice}
          </div>
        )}
        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 text-charity-crimson" role="alert">
            <p className="font-bold">{error}</p>
            <button type="button" onClick={load} className="mt-3 min-h-11 rounded-lg bg-jaguar-green px-4 py-2 text-sm font-bold text-white">Try again</button>
          </div>
        )}
        {loading && <div className="mt-6 h-80 animate-pulse rounded-2xl bg-gray-100" aria-busy="true" />}

        {!loading && !error && (
          <div className="mt-6">
            {activeTab === 'events' && <EventsAdmin events={events} onComplete={complete} />}
            {activeTab === 'attendees' && <AttendeesAdmin events={events} onComplete={complete} />}
            {activeTab === 'members' && <MembersAdmin members={members} onComplete={complete} />}
            {activeTab === 'system' && <SystemAdmin system={system} onComplete={complete} />}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function EventsAdmin({ events, onComplete }) {
  return (
    <section aria-labelledby="manage-events-heading">
      <SectionHeading
        id="manage-events-heading"
        eyebrow="Publication and deadlines"
        title="Manage events"
        copy="Spreadsheet details remain the source. Configure the secure booking windows and status here when the source does not yet provide them."
      />
      <div className="mt-5 space-y-4">
        {events.length === 0 && <EmptyState icon="event_busy" text="No events have been synchronised." />}
        {events.map((event) => <EventEditor key={event.id} event={event} onComplete={onComplete} />)}
      </div>
    </section>
  );
}

function EventEditor({ event, onComplete }) {
  const [status, setStatus] = useState(event.status);
  const [publicationAt, setPublicationAt] = useState(toLocalInput(event.publication_at));
  const [registrationOpensAt, setRegistrationOpensAt] = useState(toLocalInput(event.registration_opens_at));
  const [registrationClosesAt, setRegistrationClosesAt] = useState(toLocalInput(event.registration_closes_at));
  const [cancellationClosesAt, setCancellationClosesAt] = useState(toLocalInput(event.cancellation_closes_at));
  const [timezone, setTimezone] = useState(event.timezone || 'Europe/London');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (formEvent) => {
    formEvent.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/api/admin/events/${encodeURIComponent(event.id)}`, {
        status,
        publicationAt: toIsoOrNull(publicationAt),
        registrationOpensAt: toIsoOrNull(registrationOpensAt),
        registrationClosesAt: toIsoOrNull(registrationClosesAt),
        cancellationClosesAt: toIsoOrNull(cancellationClosesAt),
        timezone,
      });
      await onComplete(`${event.title} was updated.`);
    } catch (saveError) {
      setError(saveError.message || 'The event could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="overflow-hidden rounded-xl border border-border-light bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-jaguar-green">
        <span>
          <span className="block text-lg font-serif font-bold text-midnight-navy">{event.title}</span>
          <span className="mt-1 block text-sm text-gray-500">{formatDate(event.event_date)} · {event.venue}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-jaguar-green/10 px-3 py-1 text-xs font-bold text-jaguar-green">{event.confirmed_count || 0} confirmed</span>
          <span className="material-symbols-outlined text-gray-400" aria-hidden="true">expand_more</span>
        </span>
      </summary>
      <form onSubmit={save} className="border-t border-border-light bg-surface-light/60 p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SelectField label="Event status" value={status} onChange={setStatus} options={['draft', 'published', 'open', 'closed', 'completed']} />
          <DateTimeField label="Publish from" value={publicationAt} onChange={setPublicationAt} />
          <DateTimeField label="Registration opens" value={registrationOpensAt} onChange={setRegistrationOpensAt} />
          <DateTimeField label="Registration closes" value={registrationClosesAt} onChange={setRegistrationClosesAt} />
          <DateTimeField label="Cancellation closes" value={cancellationClosesAt} onChange={setCancellationClosesAt} />
          <TextField label="Timezone" value={timezone} onChange={setTimezone} required />
        </div>
        <p className="mt-3 text-xs text-gray-500">Times are entered in this device’s local timezone and stored as exact UTC timestamps. Event display uses the configured IANA timezone.</p>
        {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-charity-crimson" role="alert">{error}</p>}
        <button type="submit" disabled={saving} className="mt-4 min-h-11 rounded-lg bg-jaguar-green px-5 py-3 text-sm font-black text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save event settings'}
        </button>
      </form>
    </details>
  );
}

function MembersAdmin({ members, onComplete }) {
  return (
    <section aria-labelledby="manage-members-heading">
      <SectionHeading
        id="manage-members-heading"
        eyebrow="Individual access"
        title="Manage members"
        copy="New accounts are invitation-only. Temporary passwords must be changed at first sign-in."
      />
      <CreateMemberForm onComplete={onComplete} />
      <div className="mt-6 space-y-3">
        {members.map((member) => <MemberEditor member={member} key={member.id} onComplete={onComplete} />)}
      </div>
    </section>
  );
}

function CreateMemberForm({ onComplete }) {
  const initial = { displayName: '', email: '', temporaryPassword: '', role: 'member', status: 'disabled', financeUrl: '' };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/api/admin/members', form);
      setForm(initial);
      await onComplete('The member account was created.');
    } catch (createError) {
      setError(createError.message || 'The account could not be created.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 rounded-xl border border-trophy-gold/40 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-serif font-bold text-midnight-navy">Add member account</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <TextField label="Display name" value={form.displayName} onChange={update('displayName')} required />
        <TextField label="Email address" value={form.email} onChange={update('email')} type="email" required />
        <TextField label="Temporary password" value={form.temporaryPassword} onChange={update('temporaryPassword')} type="password" minLength={12} required />
        <SelectField label="Role" value={form.role} onChange={update('role')} options={['member', 'admin']} />
        <SelectField label="Initial status" value={form.status} onChange={update('status')} options={['disabled', 'active']} />
        <TextField label="Personal finance URL" value={form.financeUrl} onChange={update('financeUrl')} type="url" />
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-charity-crimson" role="alert">{error}</p>}
      <button type="submit" disabled={saving} className="mt-4 min-h-11 rounded-lg bg-jaguar-green px-5 py-3 text-sm font-black text-white disabled:opacity-60">
        {saving ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}

function MemberEditor({ member, onComplete }) {
  const [role, setRole] = useState(member.role);
  const [status, setStatus] = useState(member.status);
  const [financeUrl, setFinanceUrl] = useState(member.financeUrl || '');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/api/admin/members/${encodeURIComponent(member.id)}`, { role, status, financeUrl });
      await onComplete(`${member.displayName} was updated.`);
    } catch (saveError) {
      setError(saveError.message || 'The member could not be updated.');
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/api/admin/members/${encodeURIComponent(member.id)}/reset-password`, { temporaryPassword });
      setTemporaryPassword('');
      await onComplete(`${member.displayName} must choose a new password at next sign-in.`);
    } catch (resetError) {
      setError(resetError.message || 'The password could not be reset.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-xl border border-border-light bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-serif text-lg font-bold text-midnight-navy">{member.displayName}</h3>
          <p className="text-sm text-gray-600">{member.email}</p>
        </div>
        {member.mustChangePassword && <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Password change required</span>}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[160px_160px_1fr_auto]">
        <SelectField label="Role" value={role} onChange={setRole} options={['member', 'admin']} />
        <SelectField label="Status" value={status} onChange={setStatus} options={['active', 'disabled']} />
        <TextField label="Personal finance URL" value={financeUrl} onChange={setFinanceUrl} type="url" />
        <button type="button" onClick={save} disabled={saving} className="min-h-11 self-end rounded-lg bg-jaguar-green px-5 py-3 text-sm font-bold text-white disabled:opacity-60">Save</button>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-border-light pt-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField label="New temporary password" value={temporaryPassword} onChange={setTemporaryPassword} type="password" minLength={12} />
        </div>
        <button type="button" onClick={reset} disabled={saving || temporaryPassword.length < 12} className="min-h-11 rounded-lg border border-midnight-navy px-5 py-3 text-sm font-bold text-midnight-navy disabled:opacity-40">Reset password</button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-charity-crimson" role="alert">{error}</p>}
    </article>
  );
}

function AttendeesAdmin({ events, onComplete }) {
  const [eventId, setEventId] = useState(events[0]?.id || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAttendees = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError('');
    try {
      setData(await api.get(`/api/admin/events/${encodeURIComponent(eventId)}/registrations`));
    } catch (loadError) {
      setError(loadError.message || 'Attendees could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadAttendees();
  }, [loadAttendees]);

  return (
    <section aria-labelledby="attendees-heading">
      <SectionHeading
        id="attendees-heading"
        eyebrow="Canonical operational list"
        title="Confirmed attendees"
        copy="Only active website bookings appear here. Members cannot view or edit this list."
      />
      <label className="mt-5 block max-w-xl text-sm font-bold text-midnight-navy">
        Event
        <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-gray-300 bg-white px-3">
          {events.map((event) => <option key={event.id} value={event.id}>{event.title} · {formatDate(event.event_date)}</option>)}
        </select>
      </label>
      {loading && <div className="mt-5 h-48 animate-pulse rounded-xl bg-gray-100" aria-busy="true" />}
      {error && <p className="mt-4 rounded-lg bg-red-50 p-4 text-charity-crimson" role="alert">{error}</p>}
      {!loading && data && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-border-light bg-white shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Confirmed attendees for {data.event.title}</caption>
            <thead className="bg-midnight-navy text-white">
              <tr>
                <th className="p-4">Member</th>
                <th className="p-4">Buggy</th>
                <th className="p-4">Dietary requirements</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {data.attendees.map((attendee) => (
                <AttendeeRow key={attendee.booking_id} attendee={attendee} onComplete={async (message) => {
                  await onComplete(message);
                  await loadAttendees();
                }} />
              ))}
              {data.attendees.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No confirmed attendees.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AttendeeRow({ attendee, onComplete }) {
  const [buggyRequired, setBuggyRequired] = useState(Boolean(attendee.buggy_required));
  const [dietaryRequirements, setDietaryRequirements] = useState(attendee.dietary_requirements || '');
  const [status, setStatus] = useState(attendee.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/api/admin/bookings/${encodeURIComponent(attendee.booking_id)}`, {
        buggyRequired,
        dietaryRequirements,
        status,
      });
      await onComplete(`${attendee.display_name}’s booking was corrected and audited.`);
    } catch (saveError) {
      setError(saveError.message || 'The booking could not be corrected.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <tr className="align-top">
      <td className="p-4">
        <span className="block font-bold text-midnight-navy">{attendee.display_name}</span>
        <span className="block text-xs text-gray-500">{attendee.email}</span>
        {error && <span className="mt-2 block text-xs font-semibold text-charity-crimson" role="alert">{error}</span>}
      </td>
      <td className="p-4"><input type="checkbox" checked={buggyRequired} onChange={(event) => setBuggyRequired(event.target.checked)} aria-label={`Buggy required for ${attendee.display_name}`} className="h-5 w-5 accent-jaguar-green" /></td>
      <td className="p-4"><input value={dietaryRequirements} onChange={(event) => setDietaryRequirements(event.target.value)} aria-label={`Dietary requirements for ${attendee.display_name}`} className="min-h-10 w-full rounded border border-gray-300 px-2" /></td>
      <td className="p-4"><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={`Booking status for ${attendee.display_name}`} className="min-h-10 rounded border border-gray-300 px-2"><option value="registered">Registered</option><option value="cancelled">Cancelled</option></select></td>
      <td className="p-4"><button type="button" onClick={save} disabled={saving} className="min-h-10 rounded bg-jaguar-green px-4 py-2 font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save'}</button></td>
    </tr>
  );
}

function SystemAdmin({ system, onComplete }) {
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const run = async (kind) => {
    setWorking(kind);
    setError('');
    try {
      if (kind === 'fixtures') {
        await api.post('/api/admin/sync');
        await onComplete('Fixture synchronisation completed successfully.');
      } else {
        const result = await api.post('/api/admin/integration');
        await onComplete(result.delivery.configured
          ? `Spreadsheet delivery completed: ${result.delivery.delivered} sent, ${result.delivery.failed} failed.`
          : result.delivery.message);
      }
    } catch (runError) {
      setError(runError.message || 'The operation could not be completed.');
    } finally {
      setWorking('');
    }
  };
  const outbox = system?.outbox || {};
  return (
    <section aria-labelledby="sync-heading">
      <SectionHeading
        id="sync-heading"
        eyebrow="Observable integration"
        title="Synchronisation and delivery"
        copy="A failed run preserves valid event and booking data. Pending and failed booking updates remain retryable."
      />
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <StatusCard
          title="Fixture source"
          icon="event_repeat"
          status={system?.lastFixtureSync?.status || 'Not run'}
          details={system?.lastFixtureSync?.completed_at ? `Last completed ${formatDateTime(system.lastFixtureSync.completed_at)}` : 'No successful sync recorded'}
        >
          <button type="button" onClick={() => run('fixtures')} disabled={Boolean(working)} className="mt-4 min-h-11 w-full rounded-lg bg-jaguar-green px-5 py-3 font-black text-white disabled:opacity-60">
            {working === 'fixtures' ? 'Synchronising…' : 'Synchronise fixtures now'}
          </button>
        </StatusCard>
        <StatusCard
          title="Booking spreadsheet delivery"
          icon="cloud_sync"
          status={(outbox.failed || 0) > 0 ? 'Attention required' : 'Healthy'}
          details={`${outbox.pending || 0} pending · ${outbox.failed || 0} failed · ${outbox.sent || 0} sent`}
        >
          <button type="button" onClick={() => run('delivery')} disabled={Boolean(working)} className="mt-4 min-h-11 w-full rounded-lg border-2 border-jaguar-green px-5 py-3 font-black text-jaguar-green disabled:opacity-60">
            {working === 'delivery' ? 'Delivering…' : 'Retry pending delivery'}
          </button>
        </StatusCard>
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-4 font-semibold text-charity-crimson" role="alert">{error}</p>}
    </section>
  );
}

function StatusCard({ title, icon, status, details, children }) {
  return (
    <article className="rounded-xl border border-border-light bg-white p-6 shadow-sm">
      <span className="material-symbols-outlined text-4xl text-trophy-gold" aria-hidden="true">{icon}</span>
      <h3 className="mt-3 text-xl font-serif font-bold text-midnight-navy">{title}</h3>
      <p className="mt-3 font-bold text-jaguar-green">{status}</p>
      <p className="mt-1 text-sm text-gray-600">{details}</p>
      {children}
    </article>
  );
}

function SectionHeading({ id, eyebrow, title, copy }) {
  return (
    <header>
      <p className="text-xs font-black uppercase tracking-[0.22em] text-trophy-gold">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl font-serif font-black text-midnight-navy">{title}</h2>
      <p className="mt-2 max-w-3xl leading-6 text-gray-600">{copy}</p>
    </header>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="rounded-xl border border-border-light bg-white p-8 text-center text-gray-600">
      <span className="material-symbols-outlined text-5xl text-trophy-gold" aria-hidden="true">{icon}</span>
      <p className="mt-3">{text}</p>
    </div>
  );
}

function TextField({ label, value, onChange, type = 'text', required = false, minLength }) {
  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm font-bold text-midnight-navy">
      {label}
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal focus:border-jaguar-green focus:outline-none focus:ring-2 focus:ring-jaguar-green/25"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm font-bold text-midnight-navy">
      {label}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal capitalize">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function DateTimeField({ label, value, onChange }) {
  const id = useId();
  return (
    <label htmlFor={id} className="block text-sm font-bold text-midnight-navy">
      {label}
      <input id={id} type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 font-normal" />
    </label>
  );
}

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value) {
  return value ? new Date(value).toISOString() : null;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
