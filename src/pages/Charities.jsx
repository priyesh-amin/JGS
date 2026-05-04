import React, { useRef } from 'react';
import MainLayout from '../layouts/MainLayout';
import fixtures from '../data/fixtures.json';

const fallbackEvent = {
  date: '17 Jun 2026',
  event: 'Charity Day',
  venue: 'Maylands Golf Club (RM3 0AZ)',
  cost: '\u00A3115',
  meetTime: '08:30',
  teeTime: '11:00',
  deadline: '01 Jun 2026',
  capacity: '128',
  package: 'Full English Breakfast, Lunch, Dinner, On-course drinks, Golf',
  schedule: '08:00 Registration, 11:00 Shotgun Start, 19:00 Dinner',
};

export default function Charities() {
  const videoRef = useRef(null);
  const charityEvent = fixtures.find((event) => event.isCharityDay) ?? fallbackEvent;
  const eventYear = charityEvent.date.split(' ').slice(-1)[0] ?? '2026';
  const includedItems = charityEvent.package
    ? charityEvent.package.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  const scheduleItems = charityEvent.schedule
    ? charityEvent.schedule.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
  const guestCapacity = Number.parseInt(charityEvent.capacity ?? '', 10);

  const detailCards = [
    { label: 'Event Date', value: charityEvent.date },
    { label: 'Venue', value: charityEvent.venue },
    { label: 'Meet Time', value: charityEvent.meetTime },
    { label: 'Shotgun Start', value: charityEvent.teeTime },
    { label: 'Entry Fee', value: charityEvent.cost },
    { label: 'Entry Deadline', value: charityEvent.deadline },
  ];

  if (Number.isFinite(guestCapacity)) {
    detailCards.push({ label: 'Capacity', value: `${guestCapacity} guests` });
  }

  const handleVideoLinkClick = () => {
    const videoElement = videoRef.current;

    if (!videoElement) {
      return;
    }

    videoElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const playPromise = videoElement.play();

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  };

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-12">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)] lg:items-stretch">
          <div className="relative flex h-full min-h-[520px] overflow-hidden rounded-3xl bg-midnight-navy px-8 py-10 text-white shadow-2xl md:px-10 md:py-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(197,160,89,0.28),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_45%)]"></div>
            <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-8 text-center">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-trophy-gold">
                  Charity Event
                </span>
                <span className="inline-flex items-center rounded-full border border-white/15 px-4 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
                  Jaguar Golf Society
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-serif font-black leading-tight md:text-6xl">
                  {charityEvent.event} {eventYear}
                </h1>
                <p className="mx-auto max-w-3xl text-lg leading-relaxed text-white/85 md:text-xl">
                  Join us at {charityEvent.venue} on {charityEvent.date} for our flagship fundraising golf day.
                  Entry includes {charityEvent.package ?? 'a full hospitality package'}, and every booking helps
                  support Jaguar Golf Society's charity programme.
                </p>
              </div>

              <div className="flex justify-center">
                <a
                  href="#charity-video"
                  onClick={handleVideoLinkClick}
                  className="inline-flex items-center justify-center gap-3 rounded-md bg-trophy-gold px-6 py-4 text-xs font-black uppercase tracking-[0.22em] text-midnight-navy transition-transform hover:scale-[1.01]"
                >
                  Watch The Event Video
                  <span className="material-symbols-outlined text-lg">play_circle</span>
                </a>
              </div>
            </div>
          </div>

          <aside className="flex h-full flex-col rounded-3xl border border-border-light bg-white p-8 shadow-xl">
            <div className="mb-6 flex items-center justify-between border-b border-border-light pb-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-charity-crimson">Event Snapshot</p>
                <h2 className="mt-2 text-3xl font-serif font-bold text-midnight-navy">Ready for the day</h2>
              </div>
              <span className="material-symbols-outlined text-4xl text-charity-crimson">volunteer_activism</span>
            </div>

            <div className="grid flex-1 content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl bg-surface-light p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-jaguar-green">Entry Fee</p>
                <p className="mt-2 text-3xl font-serif font-bold text-midnight-navy">{charityEvent.cost}</p>
              </div>
              <div className="rounded-2xl bg-surface-light p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-jaguar-green">Registration Opens</p>
                <p className="mt-2 text-2xl font-serif font-bold text-midnight-navy">08:00</p>
              </div>
              <div className="rounded-2xl bg-surface-light p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-jaguar-green">Shotgun Start</p>
                <p className="mt-2 text-2xl font-serif font-bold text-midnight-navy">{charityEvent.teeTime}</p>
              </div>
              <div className="rounded-2xl bg-surface-light p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-jaguar-green">Fundraising Focus</p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-midnight-navy">
                  50% of funds raised support UK charities and 50% support international charities.
                </p>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="rounded-3xl border border-border-light bg-white p-8 shadow-lg">
            <div className="mb-6 flex items-center gap-3 border-b border-border-light pb-4">
              <span className="material-symbols-outlined text-3xl text-jaguar-green">event</span>
              <div>
                <h2 className="text-3xl font-serif font-bold text-midnight-navy">Event details</h2>
                <p className="text-sm font-medium text-midnight-navy/70">The key information visitors need at a glance.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {detailCards.map((detail) => (
                <div key={detail.label} className="rounded-2xl border border-border-light bg-surface-light p-5 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-jaguar-green">{detail.label}</p>
                  <p className="mt-3 text-lg font-semibold leading-snug text-midnight-navy">{detail.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-8">
            <div className="rounded-3xl border border-border-light bg-white p-8 shadow-lg">
              <div className="mb-5 flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-trophy-gold">featured_seasonal_and_gifts</span>
                <h2 className="text-3xl font-serif font-bold text-midnight-navy">What's included</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {includedItems.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-jaguar-green/15 bg-jaguar-green/5 px-4 py-2 text-sm font-semibold text-midnight-navy"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-border-light bg-white p-8 shadow-lg">
              <div className="mb-5 flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-charity-crimson">schedule</span>
                <h2 className="text-3xl font-serif font-bold text-midnight-navy">Day schedule</h2>
              </div>
              <div className="space-y-3">
                {scheduleItems.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-surface-light px-4 py-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-charity-crimson"></span>
                    <p className="text-sm font-semibold text-midnight-navy">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="charity-video" className="scroll-mt-28 overflow-hidden rounded-3xl border border-border-light bg-white shadow-xl">
          <div className="bg-midnight-navy px-8 py-6 text-white">
            <h2 className="text-3xl font-serif font-bold">Event Video</h2>
          </div>

          <div className="p-8">
            <div className="overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-black/10">
              <video ref={videoRef} controls preload="metadata" playsInline className="h-auto max-h-[70vh] w-full bg-black">
                <source src="/videos/charity-event-2026.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
