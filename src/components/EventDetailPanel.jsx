import React, { useState } from 'react';

export default function EventDetailPanel({ event, signups }) {
    const [activeTab, setActiveTab] = useState('details');

    const members = signups?.members ?? [];
    const count = signups?.count ?? members.length;

    const detailRows = [
        { label: 'Event Date', value: event.date },
        { label: 'Venue / Course', value: event.venue },
        { label: 'Cost', value: event.cost },
        event.package && { label: "What's Included", value: event.package },
        event.meetTime && { label: 'Meet Time', value: event.meetTime },
        event.teeTime && { label: 'First Tee Time', value: event.teeTime },
        event.deadline && { label: 'Sign Up By', value: event.deadline },
        event.capacity && { label: 'Max Players', value: event.capacity },
        event.schedule && { label: 'Schedule', value: event.schedule },
        event.details && { label: 'Notes', value: event.details },
    ].filter(Boolean);

    return (
        <div className="border-t border-jaguar-green/20 bg-gradient-to-b from-jaguar-green/5 to-transparent animate-in">
            {/* Tab Bar */}
            <div className="flex border-b border-border-light bg-white/60 px-4 md:px-6">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${
                        activeTab === 'details'
                            ? 'border-jaguar-green text-jaguar-green'
                            : 'border-transparent text-midnight-navy/50 hover:text-midnight-navy'
                    }`}
                >
                    <span className="material-symbols-outlined text-base">info</span>
                    Event Details
                </button>
                <button
                    onClick={() => setActiveTab('signups')}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${
                        activeTab === 'signups'
                            ? 'border-jaguar-green text-jaguar-green'
                            : 'border-transparent text-midnight-navy/50 hover:text-midnight-navy'
                    }`}
                >
                    <span className="material-symbols-outlined text-base">group</span>
                    Sign-Up List
                    {count > 0 && (
                        <span className="ml-1 rounded-full bg-jaguar-green text-white text-[10px] font-black px-2 py-0.5">
                            {count}
                        </span>
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="p-4 md:p-6">
                {activeTab === 'details' ? (
                    <EventDetailsTab event={event} detailRows={detailRows} />
                ) : (
                    <SignupListTab members={members} count={count} event={event} />
                )}
            </div>
        </div>
    );
}

function EventDetailsTab({ event, detailRows }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 max-w-4xl">
            {detailRows.map(({ label, value }) => (
                <div key={label} className="flex gap-3 py-2 border-b border-border-light/60 last:border-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-midnight-navy/50 w-32 shrink-0 pt-0.5">
                        {label}
                    </span>
                    <span className="text-sm font-medium text-midnight-navy leading-snug">
                        {value}
                    </span>
                </div>
            ))}
            {event.formUrl && (
                <div className="col-span-full pt-4">
                    <a
                        href={event.formUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded bg-jaguar-green px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow hover:bg-jaguar-green/90 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-base">how_to_reg</span>
                        Register / Cancel for this Event
                        <span className="material-symbols-outlined text-base">open_in_new</span>
                    </a>
                </div>
            )}
        </div>
    );
}

function SignupListTab({ members, count, event }) {
    if (!members || members.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                <span className="material-symbols-outlined text-4xl text-midnight-navy/20">group_off</span>
                <p className="text-sm font-medium text-midnight-navy/50">
                    {event.formUrl
                        ? 'Sign-up data not yet synced. Run the admin sync to load the latest.'
                        : 'Registration for this event is not yet open.'}
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* Summary */}
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-jaguar-green text-xl">group</span>
                <span className="text-sm font-bold text-midnight-navy">
                    {count} member{count !== 1 ? 's' : ''} signed up
                </span>
            </div>

            {/* Table */}
            <div className="w-full overflow-x-auto rounded-lg border border-border-light shadow-sm">
                <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                        <tr className="bg-midnight-navy/5 border-b border-border-light">
                            <th className="p-3 text-[10px] font-black uppercase tracking-widest text-midnight-navy/60 w-6">#</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-widest text-midnight-navy/60">Member Name</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-widest text-midnight-navy/60">Requirements</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-widest text-midnight-navy/60">Email</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-widest text-midnight-navy/60 text-right">HCP</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-widest text-midnight-navy/60 text-right">Signed Up</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light/60">
                        {members.map((member, idx) => (
                            <tr
                                key={idx}
                                className={`text-sm transition-colors hover:bg-jaguar-green/5 ${idx % 2 === 0 ? 'bg-white' : 'bg-surface-light/40'}`}
                            >
                                <td className="p-3 text-xs text-midnight-navy/30 font-mono">{idx + 1}</td>
                                <td className="p-3 font-semibold text-midnight-navy">{member.name}</td>
                                <td className="p-3 text-midnight-navy/70">
                                    {member.requirements ? (
                                        <span className="inline-block rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                                            {member.requirements}
                                        </span>
                                    ) : (
                                        <span className="text-midnight-navy/30">-</span>
                                    )}
                                </td>
                                <td className="p-3">
                                    <a
                                        href={`mailto:${member.email}`}
                                        className="text-jaguar-green hover:underline text-xs font-medium"
                                    >
                                        {member.email}
                                    </a>
                                </td>
                                <td className="p-3 text-right font-mono text-sm font-bold text-midnight-navy">
                                    {member.handicap !== undefined && member.handicap !== '' ? member.handicap : '-'}
                                </td>
                                <td className="p-3 text-right text-xs text-midnight-navy/60 whitespace-nowrap">
                                    {member.signedUp || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-midnight-navy/5 border-t border-border-light">
                            <td colSpan={6} className="p-3 text-xs font-bold text-midnight-navy/50 text-right">
                                Total: {count} member{count !== 1 ? 's' : ''}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
