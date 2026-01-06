import React from 'react';
import MainLayout from '../layouts/MainLayout';
import fixtures from '../data/fixtures.json';

export default function CharityEvents() {
    return (
        <MainLayout>
            <div className="w-full max-w-[1280px] flex flex-col gap-12 mx-auto">
                <div className="flex flex-col gap-4 border-l-4 border-trophy-gold pl-6 py-2">
                    <h1 className="text-5xl md:text-6xl font-serif font-black leading-tight text-jaguar-green">
                        Charity Events & Fixtures
                    </h1>
                    <p className="text-midnight-navy text-xl font-medium max-w-3xl leading-relaxed">
                        Join us on the green for a noble cause. View our high-stakes schedule of upcoming charity tournaments and browse the legacy of our fundraising achievements.
                    </p>
                </div>

                {/* Calendar Table Section */}
                <section className="flex flex-col gap-6">
                    <div className="flex items-center justify-between border-b-2 border-border-light pb-3">
                        <h2 className="text-3xl font-serif font-bold text-midnight-navy flex items-center gap-3">
                            <span className="material-symbols-outlined text-jaguar-green text-3xl">calendar_month</span>
                            2026 Season Schedule
                        </h2>
                    </div>
                    <div className="w-full overflow-hidden rounded-lg border border-border-light shadow-lg bg-surface-light ring-1 ring-black/5">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-midnight-navy text-white border-b border-border-dark">
                                    <th className="p-5 text-xs font-bold uppercase tracking-widest w-28">Date</th>
                                    <th className="p-5 text-xs font-bold uppercase tracking-widest">Event Detail</th>
                                    <th className="p-5 text-xs font-bold uppercase tracking-widest hidden sm:table-cell">Venue</th>
                                    <th className="p-5 text-xs font-bold uppercase tracking-widest w-36 text-right">Register</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light font-body">
                                {fixtures.map((event) => {
                                    const [day, month] = event.date.split(' '); // "18 Apr 2026" -> ["18", "Apr"]
                                    return (
                                        <tr key={event.id} className="group hover:bg-jaguar-green/5 transition-colors relative">
                                            <td className="p-5 align-middle">
                                                <div className={`flex flex-col items-center justify-center rounded border ${event.isCharityDay ? 'border-charity-crimson text-charity-crimson' : 'border-jaguar-green text-jaguar-green'} bg-white h-14 w-16 shadow-sm`}>
                                                    <span className="text-[10px] font-black uppercase leading-none mb-1">{month}</span>
                                                    <span className="text-2xl font-serif font-black leading-none">{day}</span>
                                                </div>
                                            </td>
                                            <td className="p-5 align-middle">
                                                <div className="text-lg font-serif font-bold text-midnight-navy group-hover:text-jaguar-green transition-colors">
                                                    {event.event}
                                                    {event.isCharityDay && <span className="ml-2 inline-block px-2 py-0.5 rounded text-[10px] bg-charity-crimson text-white align-middle -mt-1">MAJOR</span>}
                                                </div>
                                            </td>
                                            <td className="p-5 text-sm text-midnight-navy hidden sm:table-cell align-middle font-medium">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[18px] text-jaguar-green">location_on</span>
                                                    {event.venue}
                                                </div>
                                            </td>
                                            <td className="p-5 text-right align-middle">
                                                <button className="inline-flex h-10 w-full items-center justify-center rounded bg-charity-crimson px-4 text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all hover:bg-red-800 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                                                    {event.status === 'Open' ? 'Enter Now' : 'Closed'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </MainLayout>
    );
}
