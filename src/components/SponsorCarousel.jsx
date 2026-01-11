import React from 'react';

export default function SponsorCarousel() {
    // Placeholder data for partners
    const partners = Array(6).fill({
        id: 1,
        label: 'Partner Logo – Placeholder'
    });

    return (
        <div className="py-12 bg-white border-y border-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <p className="text-center text-sm font-bold uppercase tracking-widest text-gray-400 mb-8">
                    Proudly Supported By
                </p>

                {/* 
                    Carousel/Grid Implementation 
                    For Phase 1: Simple responsive grid as a robust placeholder
                */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center justify-items-center opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                    {partners.map((_, index) => (
                        <div
                            key={index}
                            className="w-full h-24 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-4 text-center group hover:border-jaguar-green hover:bg-green-50 transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-400 mb-1 group-hover:text-jaguar-green">image</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-jaguar-green leading-tight">
                                Partner Logo<br />Placeholder
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
