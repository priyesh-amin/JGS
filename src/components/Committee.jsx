import React from 'react';

const committeeMembers = [
    {
        name: 'Shailendra Magdum',
        role: 'Captain & Handicap Sec',
    },
    {
        name: 'Rakesh Patel',
        role: 'Chairman',
    },
    {
        name: 'Chetan Patel',
        role: 'Treasurer',
    },
    {
        name: 'Bobby Verma',
        role: 'Secretary',
    },
    {
        name: 'Dhiren Patel',
        role: 'Social & Fixture Sec',
    },
];

export default function Committee() {
    return (
        <div className="py-16 md:py-24 bg-gray-50 border-t border-gray-200">
            <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6">
                <div className="flex flex-col items-center text-center mb-16">
                    <span className="text-trophy-gold font-bold uppercase tracking-widest text-sm mb-3">Leadership</span>
                    <h2 className="text-4xl font-serif font-black text-midnight-navy">The Committee</h2>
                    <p className="text-midnight-navy font-medium mt-4 max-w-2xl">
                        Dedicated members elected to serve the society and uphold its constitution.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {committeeMembers.map((member, index) => (
                        <div key={index} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center group hover:border-trophy-gold transition-colors duration-300">
                            <div className="size-24 rounded-full bg-gray-100 mb-6 overflow-hidden relative">
                                <div className="absolute inset-0 bg-midnight-navy/10 group-hover:bg-transparent transition-colors"></div>
                                <span className="material-symbols-outlined text-4xl text-gray-400 absolute inset-0 flex items-center justify-center">person</span>
                            </div>
                            <h3 className="text-xl font-bold text-midnight-navy">{member.name}</h3>
                            <p className="text-trophy-gold font-bold text-sm uppercase tracking-wider mt-1">{member.role}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
