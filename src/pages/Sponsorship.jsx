import React from 'react';
import MainLayout from '../layouts/MainLayout';

export default function Sponsorship() {
    const tiers = [
        {
            name: 'Gold Partner',
            price: '£500',
            color: 'bg-trophy-gold',
            textColor: 'text-jaguar-green',
            features: [
                'Premium website branding (Home & Events)',
                'Exclusive Event Naming Rights',
                'Complimentary 4-ball entry to one event',
                'Social Media Spotlight (Monthly)',
                ' VIP Seating at Annual Dinner'
            ]
        },
        {
            name: 'Silver Partner',
            price: '£250',
            color: 'bg-gray-300',
            textColor: 'text-gray-800',
            features: [
                'Hole Sponsorship at 3 Major Events',
                'Website listing with backlink',
                'Social Media Shoutout (Quarterly)',
                'Logo on Event Day materials'
            ]
        },
        {
            name: 'Bronze Partner',
            price: '£100',
            color: 'bg-orange-700',
            textColor: 'text-white',
            features: [
                'Website listing on Sponsors Page',
                'Logo on Event Day materials',
                'social Media Mention'
            ]
        }
    ];

    return (
        <MainLayout>
            {/* Hero Section */}
            <div className="relative bg-jaguar-green py-24">
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center opacity-10"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-jaguar-green via-transparent to-transparent"></div>
                </div>
                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6">
                        Partner with <span className="text-trophy-gold">Excellence</span>
                    </h1>
                    <p className="text-xl text-white/80 max-w-3xl mx-auto font-sans leading-relaxed">
                        Align your brand with the Jaguar Golf Society. Support our charity initiatives while gaining premium exposure to a dedicated community of golfers.
                    </p>
                </div>
            </div>

            {/* Philosophy / Impact Section */}
            <div className="bg-white py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-3xl font-serif font-bold text-jaguar-green mb-12">Why Sponsor Us?</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-6 bg-surface-light rounded-lg shadow-sm">
                            <span className="material-symbols-outlined text-4xl text-trophy-gold mb-4">public</span>
                            <h3 className="text-xl font-bold text-jaguar-green mb-2">Community Impact</h3>
                            <p className="text-text-light">Your support directly aids our chosen charities, making a tangible difference in the local community.</p>
                        </div>
                        <div className="p-6 bg-surface-light rounded-lg shadow-sm">
                            <span className="material-symbols-outlined text-4xl text-trophy-gold mb-4">handshake</span>
                            <h3 className="text-xl font-bold text-jaguar-green mb-2">Network Growth</h3>
                            <p className="text-text-light">Connect with business leaders and passionate golfers at our exclusive events and dinners.</p>
                        </div>
                        <div className="p-6 bg-surface-light rounded-lg shadow-sm">
                            <span className="material-symbols-outlined text-4xl text-trophy-gold mb-4">visibility</span>
                            <h3 className="text-xl font-bold text-jaguar-green mb-2">Brand Visibility</h3>
                            <p className="text-text-light">Showcase your brand across our digital platforms, social media channels, and on-course signage.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sponsorship Tiers */}
            <div className="bg-surface-light py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-serif font-bold text-jaguar-green text-center mb-12">Sponsorship Packages</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {tiers.map((tier, index) => (
                            <div key={index} className="bg-white rounded-xl shadow-xl overflow-hidden transform transition-all hover:scale-105 border border-border-light flex flex-col">
                                <div className={`${tier.color} p-6 text-center`}>
                                    <h3 className={`text-2xl font-bold ${tier.textColor} uppercase tracking-wider`}>{tier.name}</h3>
                                    <div className={`text-3xl font-black mt-2 ${tier.textColor}`}>{tier.price}</div>
                                </div>
                                <div className="p-8 flex-1 flex flex-col">
                                    <ul className="space-y-4 mb-8 flex-1">
                                        {tier.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start text-text-dark">
                                                <span className="material-symbols-outlined text-green-600 mr-3 text-xl">check_circle</span>
                                                <span className="text-sm">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button className="w-full bg-jaguar-green text-white py-3 rounded font-bold uppercase tracking-widest hover:bg-green-900 transition-colors shadow-lg">
                                        Select Package
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-jaguar-green py-16">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <h2 className="text-3xl font-serif font-bold text-white mb-6">Ready to make an impact?</h2>
                    <p className="text-white/80 mb-8 max-w-2xl mx-auto">
                        Contact our treasury team to discuss custom packages or to secure your sponsorship for the 2026 season.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <a href="mailto:treasurer@jaguargolfsociety.co.uk" className="inline-flex items-center justify-center px-8 py-4 bg-trophy-gold text-jaguar-green font-bold rounded shadow-lg hover:bg-yellow-500 transition-colors uppercase tracking-wider">
                            <span className="material-symbols-outlined mr-2">mail</span>
                            Contact Treasurer
                        </a>
                        <button className="inline-flex items-center justify-center px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded shadow-lg hover:bg-white/10 transition-colors uppercase tracking-wider">
                            <span className="material-symbols-outlined mr-2">download</span>
                            Download Prospectus
                        </button>
                    </div>
                </div>
            </div>

        </MainLayout>
    );
}
