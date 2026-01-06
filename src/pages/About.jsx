import React from 'react';
import MainLayout from '../layouts/MainLayout';

export default function About() {
    return (
        <MainLayout>
            <div className="w-full max-w-[1280px] flex flex-col gap-12 mx-auto">


                {/* Impact Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="flex flex-col gap-3 rounded-lg p-6 bg-white shadow-sm border-t-4 border-trophy-gold">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">2023 Distributed</p>
                            <span className="material-symbols-outlined text-trophy-gold">savings</span>
                        </div>
                        <p className="text-midnight-navy font-serif text-3xl font-bold leading-tight">£36,028</p>
                        <p className="text-xs text-green-700 font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            Verified Record
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 rounded-lg p-6 bg-white shadow-sm border-t-4 border-midnight-navy">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">2026 Projected</p>
                            <span className="material-symbols-outlined text-trophy-gold">trending_up</span>
                        </div>
                        <p className="text-midnight-navy font-serif text-3xl font-bold leading-tight">£15,000</p>
                        <p className="text-xs text-gray-500 font-medium">Target for 5 Charities</p>
                    </div>
                    <div className="flex flex-col gap-3 rounded-lg p-6 bg-white shadow-sm border-t-4 border-trophy-gold">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Events Held</p>
                            <span className="material-symbols-outlined text-trophy-gold">event_available</span>
                        </div>
                        <p className="text-midnight-navy font-serif text-3xl font-bold leading-tight">120+</p>
                        <p className="text-xs text-gray-500 font-medium">Since Inception</p>
                    </div>
                    <div className="flex flex-col gap-3 rounded-lg p-6 bg-white shadow-sm border-t-4 border-midnight-navy">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Key Guest (2018)</p>
                            <span className="material-symbols-outlined text-trophy-gold">star</span>
                        </div>
                        <p className="text-midnight-navy font-serif text-xl font-bold leading-tight">Mayor of Havering</p>
                        <p className="text-xs text-gray-500 font-medium">& Honey Kalaria</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Funds Allocation Chart */}
                    <div className="lg:col-span-2 flex flex-col gap-10">
                        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-2xl font-serif font-bold text-midnight-navy">Funds Allocation (2023)</h3>
                                    <p className="text-sm text-gray-500 mt-1">Distribution of funds raised during the record-breaking 2023 season</p>
                                </div>
                                <div className="px-3 py-1 bg-gray-100 rounded text-xs font-bold text-midnight-navy uppercase tracking-wider">2023</div>
                            </div>
                            <div className="grid min-h-[240px] grid-cols-3 gap-4 sm:gap-8 items-end justify-items-center px-4">
                                <div className="flex flex-col items-center gap-3 w-full group">
                                    <div className="text-xs font-bold text-midnight-navy opacity-0 group-hover:opacity-100 transition-opacity">£12,000</div>
                                    <div className="bg-gray-50 relative w-full rounded-t overflow-hidden h-52 flex items-end">
                                        <div className="w-full bg-midnight-navy hover:bg-trophy-gold transition-all duration-500" style={{ height: '90%' }}></div>
                                    </div>
                                    <p className="text-midnight-navy text-[10px] sm:text-xs font-bold tracking-widest uppercase text-center border-t border-gray-200 pt-2 w-full">Prostate Cancer UK</p>
                                </div>
                                <div className="flex flex-col items-center gap-3 w-full group">
                                    <div className="text-xs font-bold text-midnight-navy opacity-0 group-hover:opacity-100 transition-opacity">£8,150</div>
                                    <div className="bg-gray-50 relative w-full rounded-t overflow-hidden h-52 flex items-end">
                                        <div className="w-full bg-trophy-gold hover:bg-midnight-navy transition-all duration-500" style={{ height: '65%' }}></div>
                                    </div>
                                    <p className="text-midnight-navy text-[10px] sm:text-xs font-bold tracking-widest uppercase text-center border-t border-gray-200 pt-2 w-full">County Hospice</p>
                                </div>
                                <div className="flex flex-col items-center gap-3 w-full group">
                                    <div className="text-xs font-bold text-midnight-navy opacity-0 group-hover:opacity-100 transition-opacity">£4,500</div>
                                    <div className="bg-gray-50 relative w-full rounded-t overflow-hidden h-52 flex items-end">
                                        <div className="w-full bg-midnight-navy hover:bg-trophy-gold transition-all duration-500" style={{ height: '40%' }}></div>
                                    </div>
                                    <p className="text-midnight-navy text-[10px] sm:text-xs font-bold tracking-widest uppercase text-center border-t border-gray-200 pt-2 w-full">Veterans Aid</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Impact Timeline */}
                    <div className="flex flex-col gap-6">
                        <div className="rounded-lg bg-white p-6 h-full border border-gray-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-midnight-navy via-trophy-gold to-midnight-navy"></div>
                            <h3 className="text-xl font-serif font-bold text-midnight-navy mb-8 flex items-center gap-3">
                                <span className="material-symbols-outlined text-trophy-gold">history_edu</span> Highlights
                            </h3>
                            <div className="grid grid-cols-[32px_1fr] gap-x-4">
                                {/* Timeline Item 1 */}
                                <div className="flex flex-col items-center gap-1 pt-1">
                                    <div className="flex size-8 items-center justify-center rounded-full bg-midnight-navy shadow-md z-10">
                                        <span className="material-symbols-outlined text-[16px] text-trophy-gold">celebration</span>
                                    </div>
                                    <div className="w-[2px] bg-gray-200 h-full grow my-1"></div>
                                </div>
                                <div className="flex flex-col pb-10">
                                    <span className="text-xs font-bold text-trophy-gold uppercase tracking-widest mb-1">Jun 2018</span>
                                    <p className="text-midnight-navy text-lg font-serif font-bold leading-tight">Honoured Guests</p>
                                    <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                                        The Mayor of Havering and Honey Kalaria attended our Charity Day, celebrating the community spirit of the society.
                                    </p>
                                </div>

                                {/* Timeline Item 2 */}
                                <div className="flex flex-col items-center gap-1 pt-1">
                                    <div className="flex size-8 items-center justify-center rounded-full bg-white border-2 border-midnight-navy shadow-sm z-10">
                                        <span className="material-symbols-outlined text-[16px] text-midnight-navy">savings</span>
                                    </div>
                                    <div className="w-[2px] bg-gray-200 h-full grow my-1"></div>
                                </div>
                                <div className="flex flex-col pb-10">
                                    <span className="text-xs font-bold text-trophy-gold uppercase tracking-widest mb-1">2023 Season</span>
                                    <p className="text-midnight-navy text-lg font-serif font-bold leading-tight">Record Fundraising</p>
                                    <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                                        A total of £36,028 was distributed to causes including Prostate Cancer UK and Local Youth Golf.
                                    </p>
                                </div>

                                {/* Timeline Item 3 - Sponsors */}
                                <div className="flex flex-col items-center gap-1 pt-1">
                                    <div className="flex size-8 items-center justify-center rounded-full bg-white border-2 border-midnight-navy shadow-sm z-10">
                                        <span className="material-symbols-outlined text-[16px] text-midnight-navy">handshake</span>
                                    </div>
                                    <div className="w-[2px] bg-gray-200 h-full grow my-1"></div>
                                </div>
                                <div className="flex flex-col pb-10">
                                    <span className="text-xs font-bold text-trophy-gold uppercase tracking-widest mb-1">Community</span>
                                    <p className="text-midnight-navy text-lg font-serif font-bold leading-tight">Sponsors & Support</p>
                                    <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                                        Special thanks to GK Telecom (Gummy & Ravi) and members Minesh R, Atul P, and Atul R for their pivotal role in ensuring the success of our Charity Days.
                                    </p>
                                </div>

                                {/* Timeline Item 4 */}
                                <div className="flex flex-col items-center gap-1 pt-1">
                                    <div className="flex size-8 items-center justify-center rounded-full bg-white border-2 border-midnight-navy shadow-sm z-10">
                                        <span className="material-symbols-outlined text-[16px] text-midnight-navy">groups</span>
                                    </div>
                                    <div className="w-[2px] bg-gray-200 h-full grow my-1"></div>
                                </div>
                                <div className="flex flex-col pb-10">
                                    <span className="text-xs font-bold text-trophy-gold uppercase tracking-widest mb-1">Dec 2016</span>
                                    <p className="text-midnight-navy text-lg font-serif font-bold leading-tight">Resilience</p>
                                    <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                                        New committee established to ensure the continuity and growth of JGS.
                                    </p>
                                </div>

                                {/* Timeline End */}
                                <div className="flex flex-col items-center pt-1">
                                    <div className="size-3 rounded-full bg-trophy-gold"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Committee Section */}
                <div className="py-16 md:py-24 bg-gray-50 border-t border-gray-200">
                    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6">
                        <div className="flex flex-col items-center text-center mb-16">
                            <span className="text-trophy-gold font-bold uppercase tracking-widest text-sm mb-3">Leadership</span>
                            <h2 className="text-4xl font-serif font-black text-midnight-navy">The Committee</h2>
                            <p className="text-gray-500 mt-4 max-w-2xl">
                                Dedicated members elected to serve the society and uphold its constitution.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* Captain */}
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:border-trophy-gold transition-colors duration-300">
                                <div className="size-24 rounded-full bg-gray-100 mb-6 overflow-hidden relative">
                                    <div className="absolute inset-0 bg-midnight-navy/10 group-hover:bg-transparent transition-colors"></div>
                                    <span className="material-symbols-outlined text-4xl text-gray-400 absolute inset-0 flex items-center justify-center">person</span>
                                </div>
                                <h3 className="text-xl font-bold text-midnight-navy">Shailendra Magdum</h3>
                                <p className="text-trophy-gold font-bold text-sm uppercase tracking-wider mt-1">Captain & Handicap Sec</p>
                            </div>

                            {/* Chairman */}
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:border-trophy-gold transition-colors duration-300">
                                <div className="size-24 rounded-full bg-gray-100 mb-6 overflow-hidden relative">
                                    <div className="absolute inset-0 bg-midnight-navy/10 group-hover:bg-transparent transition-colors"></div>
                                    <span className="material-symbols-outlined text-4xl text-gray-400 absolute inset-0 flex items-center justify-center">person</span>
                                </div>
                                <h3 className="text-xl font-bold text-midnight-navy">Rakesh Patel</h3>
                                <p className="text-trophy-gold font-bold text-sm uppercase tracking-wider mt-1">Chairman</p>
                            </div>

                            {/* Treasurer */}
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:border-trophy-gold transition-colors duration-300">
                                <div className="size-24 rounded-full bg-gray-100 mb-6 overflow-hidden relative">
                                    <div className="absolute inset-0 bg-midnight-navy/10 group-hover:bg-transparent transition-colors"></div>
                                    <span className="material-symbols-outlined text-4xl text-gray-400 absolute inset-0 flex items-center justify-center">person</span>
                                </div>
                                <h3 className="text-xl font-bold text-midnight-navy">Chetan Patel</h3>
                                <p className="text-trophy-gold font-bold text-sm uppercase tracking-wider mt-1">Treasurer</p>
                            </div>

                            {/* Secretary */}
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:border-trophy-gold transition-colors duration-300">
                                <div className="size-24 rounded-full bg-gray-100 mb-6 overflow-hidden relative">
                                    <div className="absolute inset-0 bg-midnight-navy/10 group-hover:bg-transparent transition-colors"></div>
                                    <span className="material-symbols-outlined text-4xl text-gray-400 absolute inset-0 flex items-center justify-center">person</span>
                                </div>
                                <h3 className="text-xl font-bold text-midnight-navy">Bobby Verma</h3>
                                <p className="text-trophy-gold font-bold text-sm uppercase tracking-wider mt-1">Secretary</p>
                            </div>

                            {/* Social & Fixture Secretary */}
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:border-trophy-gold transition-colors duration-300">
                                <div className="size-24 rounded-full bg-gray-100 mb-6 overflow-hidden relative">
                                    <div className="absolute inset-0 bg-midnight-navy/10 group-hover:bg-transparent transition-colors"></div>
                                    <span className="material-symbols-outlined text-4xl text-gray-400 absolute inset-0 flex items-center justify-center">person</span>
                                </div>
                                <h3 className="text-xl font-bold text-midnight-navy">Dhiren Patel</h3>
                                <p className="text-trophy-gold font-bold text-sm uppercase tracking-wider mt-1">Social & Fixture Sec</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
