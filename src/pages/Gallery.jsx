import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import SponsorCarousel from '../components/SponsorCarousel';

// Placeholder data for gallery images
const GALLERY_IMAGES = [
    {
        id: 1,
        title: 'Celebrity Appearance',
        year: '2014',
        image: '/images/celebrity-guests.png',
        description: 'Chris Gayle & Kapil Dev'
    },
    {
        id: 2,
        title: 'Charity Invitation',
        year: '2014',
        image: '/images/charity-poster-2014.png',
        description: 'Maylands Golf & Country Club'
    },
    ...Array(10).fill({
        id: 0,
        title: 'Event Moment',
        year: '2025'
    })
];

export default function Gallery() {
    // Simulate lazy loading state
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 800);
        return () => clearTimeout(timer);
    }, []);

    return (
        <MainLayout>
            <div className="bg-surface-light min-h-screen">
                {/* Hero Section */}
                <div className="relative bg-midnight-navy py-20">
                    <div className="absolute inset-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center opacity-20"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-midnight-navy via-transparent to-transparent"></div>
                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
                            Society <span className="text-trophy-gold">Gallery</span>
                        </h1>
                        <p className="text-lg text-white/80 max-w-2xl mx-auto font-sans">
                            A visual history of our competition, camaraderie, and charitable impact.
                        </p>
                    </div>
                </div>

                {/* Main Gallery Grid */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
                            {Array(6).fill(0).map((_, i) => (
                                <div key={i} className="bg-gray-200 h-64 rounded-xl w-full"></div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {GALLERY_IMAGES.map((img, index) => (
                                <div key={index} className="group relative overflow-hidden rounded-xl shadow-lg bg-white h-64 border border-border-light cursor-pointer">
                                    {/* Image or Placeholder */}
                                    {img.image ? (
                                        <div className="absolute inset-0">
                                            <img
                                                src={img.image}
                                                alt={img.title}
                                                className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
                                            />
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center p-6 text-center group-hover:bg-gray-50 transition-colors">
                                            <span className="material-symbols-outlined text-4xl text-gray-300 mb-2 group-hover:text-jaguar-green transition-colors">photo_camera</span>
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest group-hover:text-jaguar-green transition-colors">
                                                Event Image – Placeholder
                                            </span>
                                        </div>
                                    )}

                                    {/* Overlay on Hover */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                                        <div>
                                            <p className="text-trophy-gold font-bold text-sm uppercase tracking-wider">{img.year}</p>
                                            <p className="text-white font-serif text-xl">{img.title} {index + 1}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-12 text-center">
                        <p className="text-text-light text-sm italic mb-4">
                            Detailed photo archive available for members in the private portal.
                        </p>
                    </div>
                </div>

                {/* Partner Showcase (SponsorCarousel) */}
                <div className="bg-white">
                    <SponsorCarousel />
                </div>
            </div>
        </MainLayout>
    );
}
