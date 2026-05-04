import React, { useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import fixtures from '../data/fixtures.json';
import allSignups from '../data/signups.json';
import EventDetailPanel from '../components/EventDetailPanel';

export default function CharityEvents() {
    const [expandedId, setExpandedId] = useState(null);

    const toggleRow = (id) => {
        setExpandedId(prev => (prev === id ? null : id));
    };

    return (
        <MainLayout>
            <div className="w-full max-w-[1280px] flex flex-col gap-12 mx-auto">
                <div className="flex flex-col gap-4 border-l-4 border-trophy-gold pl-6 py-2">
                    <h1 className="text-5xl md:text-6xl font-serif font-black leading-tight text-jaguar-green">
                        Charity Events &amp; Fixtures
                    </h1>
                    <p className="text-midnight-navy text-xl font-medium max-w-3xl leading-relaxed">
                        Join us on the green for a noble cause. View our high-stakes schedule of upcoming charity tournaments and browse the legacy of our fundraising achievements.
                    </p>
                </div>

                {/* Calendar Table Section */}
                <section className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4 border-b-2 border-border-light pb-3 md:flex-row md:items-center md:justify-between">
                        <h2 className="text-3xl font-serif font-bold text-midnight-navy flex items-center gap-3">
                            <span className="material-symbols-outlined text-jaguar-green text-3xl">calendar_month</span>
                            2026 Season Schedule
                        </h2>
                    </div>
                    <div className="w-full overflow-x-auto rounded-lg border border-border-light shadow-lg bg-surface-light ring-1 ring-black/5">
                        <table className="w-full text-left border-collapse min-w-[350px]">
                            <thead>
                                <tr className="bg-midnight-navy text-white border-b border-border-dark">
                                    <th className="p-3 md:p-5 text-xs font-bold uppercase tracking-widest w-20 md:w-28">Date</th>
                                    <th className="p-3 md:p-5 text-xs font-bold uppercase tracking-widest">Event Detail</th>
                                    <th className="p-3 md:p-5 text-xs font-bold uppercase tracking-widest hidden sm:table-cell">Venue</th>
                                    <th className="p-3 md:p-5 text-xs font-bold uppercase tracking-widest text-right w-24 md:w-32">Members</th>
                                    <th className="p-3 md:p-5 text-xs font-bold uppercase tracking-widest w-28 md:w-36 text-right">Register</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fixtures.map((event) => {
                                    const [dayOfMonth, month, year] = event.date.split(' ');
                                    const dateObj = new Date(`${month} ${dayOfMonth}, ${year}`);
                                    const dayOfWeek = dateObj.toLocaleDateString('en-GB', { weekday: 'short' });
                                    const isExpanded = expandedId === event.id;
                                    const signups = allSignups[event.id] ?? { count: 0, members: [] };
                                    const memberCount = signups.count || signups.members?.length || 0;

                                    return (
                                        <React.Fragment key={event.id}>
                                            {/* Main Row */}
                                            <tr
                                                className={`group transition-colors relative border-b border-border-light/60 ${isExpanded ? 'bg-jaguar-green/5' : 'hover:bg-jaguar-green/5'}`}
                                            >
                                                {/* Date Cell — clickable to expand */}
                                                <td
                                                    className="p-3 md:p-5 align-middle cursor-pointer"
                                                    onClick={() => toggleRow(event.id)}
                                                    title="Click to view event details"
                                                >
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className={`flex flex-col items-center justify-center rounded border ${event.isCharityDay ? 'border-charity-crimson text-charity-crimson' : 'border-jaguar-green text-jaguar-green'} bg-white h-14 w-14 md:h-16 md:w-16 shadow-sm transition-transform group-hover:scale-105`}>
                                                            <span className="text-[9px] font-bold uppercase leading-none mb-0.5 opacity-70">{dayOfWeek}</span>
                                                            <span className="text-xl md:text-2xl font-serif font-black leading-none mb-0.5">{dayOfMonth}</span>
                                                            <span className="text-[9px] font-black uppercase leading-none">{month}</span>
                                                        </div>
                                                        {/* Expand chevron */}
                                                        <span className={`material-symbols-outlined text-base transition-transform duration-200 ${isExpanded ? 'text-jaguar-green rotate-180' : 'text-midnight-navy/20 group-hover:text-jaguar-green/50'}`}>
                                                            expand_more
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Event Name Cell */}
                                                <td
                                                    className="p-3 md:p-5 align-middle cursor-pointer"
                                                    onClick={() => toggleRow(event.id)}
                                                >
                                                    <div className="text-base md:text-lg font-serif font-bold text-midnight-navy group-hover:text-jaguar-green transition-colors">
                                                        {event.event}
                                                        {event.isCharityDay && (
                                                            <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] bg-charity-crimson text-white align-middle -mt-1">MAJOR</span>
                                                        )}
                                                    </div>
                                                    {event.deadline && (
                                                        <div className="text-xs text-midnight-navy/40 mt-0.5 font-medium">
                                                            Deadline: {event.deadline}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Venue Cell */}
                                                <td className="p-3 md:p-5 text-sm text-midnight-navy hidden sm:table-cell align-middle font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[18px] text-jaguar-green">location_on</span>
                                                        {event.venue}
                                                    </div>
                                                </td>

                                                {/* Member Count Cell */}
                                                <td className="p-3 md:p-5 text-right align-middle">
                                                    {memberCount > 0 ? (
                                                        <button
                                                            onClick={() => {
                                                                if (expandedId !== event.id) setExpandedId(event.id);
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-full bg-jaguar-green/10 border border-jaguar-green/30 px-3 py-1.5 text-xs font-bold text-jaguar-green hover:bg-jaguar-green/20 transition-colors"
                                                            title="View sign-up list"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">group</span>
                                                            {memberCount}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-midnight-navy/25 font-medium">—</span>
                                                    )}
                                                </td>

                                                {/* Register Button Cell */}
                                                <td className="p-3 md:p-5 text-right align-middle">
                                                    {event.status === 'Open' && event.formUrl ? (
                                                        <a
                                                            href={event.formUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex h-8 md:h-10 w-full items-center justify-center rounded bg-charity-crimson px-3 md:px-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all hover:bg-red-800 hover:shadow-lg active:scale-95"
                                                        >
                                                            Enter Now
                                                        </a>
                                                    ) : event.status === 'Open' ? (
                                                        <button
                                                            disabled
                                                            className="inline-flex h-8 md:h-10 w-full items-center justify-center rounded bg-gray-400 px-3 md:px-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-white shadow-md opacity-60 cursor-not-allowed"
                                                        >
                                                            Coming Soon
                                                        </button>
                                                    ) : (
                                                        <button
                                                            disabled
                                                            className="inline-flex h-8 md:h-10 w-full items-center justify-center rounded bg-charity-crimson px-3 md:px-4 text-[10px] md:text-xs font-bold uppercase tracking-wider text-white shadow-md opacity-50 cursor-not-allowed"
                                                        >
                                                            Closed
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Expanded Detail Panel Row */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={5} className="p-0">
                                                        <EventDetailPanel
                                                            event={event}
                                                            signups={signups}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-midnight-navy/40 text-center">
                        Click any event row or date to view full details and sign-up list.
                    </p>
                </section>
            </div>
        </MainLayout>
    );
}
