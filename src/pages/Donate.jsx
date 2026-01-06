import React from 'react';
import MainLayout from '../layouts/MainLayout';

export default function Donate() {
    return (
        <MainLayout>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative">
             <div className="lg:col-span-12 flex flex-col gap-8">
                 <div className="space-y-4 text-center lg:text-left">
                     <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-black tracking-tight text-text-main leading-tight">
                        Driving Change Through <span className="text-trophy-gold italic">Golf</span>.
                     </h1>
                     <p className="text-lg text-gray-500 max-w-2xl leading-relaxed">
                        Your contributions directly fund junior scholarships, local community initiatives, and environmental conservation on the course. 100% of public donations go to the cause.
                     </p>
                 </div>
                 
                 <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm p-8 max-w-xl mx-auto lg:mx-0">
                    <h2 className="text-2xl font-serif font-bold text-midnight-navy mb-6">Secure Donation</h2>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <button className="h-14 flex items-center justify-center rounded-lg border border-gray-200 bg-white font-bold hover:bg-gray-50 text-midnight-navy shadow-sm focus:ring-2 ring-trophy-gold">$25</button>
                        <button className="h-14 flex items-center justify-center rounded-lg border border-trophy-gold bg-trophy-gold/10 font-bold text-trophy-gold shadow-sm">$50</button>
                        <button className="h-14 flex items-center justify-center rounded-lg border border-gray-200 bg-white font-bold hover:bg-gray-50 text-midnight-navy shadow-sm focus:ring-2 ring-trophy-gold">$100</button>
                    </div>
                    <button className="w-full h-14 bg-charity-crimson hover:bg-red-800 text-white font-bold text-xl rounded-lg shadow-lg transition-all flex items-center justify-center gap-3">
                        <span>Donate Now</span>
                        <span className="material-symbols-outlined font-black">arrow_forward</span>
                    </button>
                 </div>
             </div>
          </div>
        </MainLayout>
    );
}
