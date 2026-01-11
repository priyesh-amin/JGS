import React from 'react';
import MainLayout from '../layouts/MainLayout';

import leaderboards from '../data/leaderboards.json';

const LeaderboardCard = ({ title, icon, colorClass, borderColor, data, showScore = false, textColor = "text-white" }) => (
    <div className={`bg-white rounded-lg shadow-xl overflow-hidden border-t-4 ${borderColor} flex flex-col h-full`}>
        <div className={`${colorClass} p-6 text-center`}>
            <h2 className={`text-2xl font-serif font-bold ${textColor} flex items-center justify-center gap-3`}>
                <span className={`material-symbols-outlined ${textColor === 'text-white' ? 'text-trophy-gold' : 'text-jaguar-green'}`}>{icon}</span>
                {title}
            </h2>
        </div>
        <div className="p-0 flex-grow">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b-2 border-border-light bg-surface-light">
                            <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-text-light w-24">Year</th>
                            <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-text-light">Winner</th>
                            {showScore && <th className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-text-light text-right">Venue/Score</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                        {data.map((item, index) => (
                            <tr key={index} className="hover:bg-surface-light transition-colors">
                                <td className="py-3 px-6 font-bold text-jaguar-green">{item.year}</td>
                                <td className="py-3 px-6 font-medium text-text-dark">{item.winner}</td>
                                {showScore && <td className="py-3 px-6 text-sm text-right text-gray-600 font-medium">{item.score}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
);

export default function Leaderboards() {
    return (
        <MainLayout>
            <div className="bg-surface-light min-h-screen pb-12">
                {/* Hero Section */}
                <div className="relative bg-jaguar-green py-20">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute inset-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center opacity-10"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-jaguar-green via-transparent to-transparent"></div>
                    </div>
                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
                            Hall of <span className="text-trophy-gold">Fame</span>
                        </h1>
                        <p className="text-lg text-white/80 max-w-2xl mx-auto font-sans">
                            Celebrating the champions and leaders who have shaped the legacy of the Jaguar Golf Society.
                        </p>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* Player of the Year */}
                        <LeaderboardCard
                            title="Player of the Year"
                            icon="trophy"
                            colorClass="bg-jaguar-green"
                            borderColor="border-trophy-gold"
                            data={leaderboards.poy}
                        />

                        {/* Singles Cup */}
                        <LeaderboardCard
                            title="Singles Cup Winner"
                            icon="sports_golf"
                            colorClass="bg-midnight-navy"
                            borderColor="border-trophy-gold"
                            data={leaderboards.singles}
                        />

                        {/* Radha Cup */}
                        <LeaderboardCard
                            title="Radha Cup"
                            icon="groups"
                            colorClass="bg-charity-crimson"
                            borderColor="border-midnight-navy"
                            data={leaderboards.radha}
                            showScore={true}
                        />

                        {/* Doubles Winners */}
                        <LeaderboardCard
                            title="Winners of Doubles"
                            icon="handshake"
                            colorClass="bg-trophy-gold"
                            borderColor="border-black"
                            textColor="text-jaguar-green"
                            data={leaderboards.doubles}
                        />

                    </div>

                    {/* Call to Action which acts as a filler for now */}

                </div>
            </div>
        </MainLayout>
    );
}
