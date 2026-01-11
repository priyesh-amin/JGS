import React, { useMemo } from 'react';
import MainLayout from '../layouts/MainLayout';
import { Link } from 'react-router-dom';
import fixtures from '../data/fixtures.json';
import SocietyObjectives from '../components/SocietyObjectives';
import Committee from '../components/Committee';

export default function Home() {
  // Find the Featured Charity Day (IsCharityDay = true)
  const featuredEvent = useMemo(() => {
    return fixtures.find(f => f.isCharityDay) || fixtures[0];
  }, []);

  return (
    <MainLayout>
      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 h-auto lg:h-[600px]">
        {/* Main Hero Content */}
        <div className="lg:col-span-8 relative bg-midnight-navy rounded-3xl overflow-hidden shadow-2xl group">
          <div className="absolute inset-0 bg-[url('/images/hero-bg-2026.png')] bg-cover bg-center transition-transform duration-700 group-hover:scale-105"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-midnight-navy via-midnight-navy/40 to-black/30"></div>

          <div className="relative z-10 h-full flex flex-col justify-end items-center text-center p-8 md:p-12 pb-2">
            <p className="text-white/90 text-lg md:text-xl font-light tracking-wide uppercase mb-7 drop-shadow-md">
              Est. 2011 &bull; Community &bull; Charity &bull; Competition
            </p>

            <img
              src="/images/logo-hero.png"
              alt="Jaguar Golf Society"
              className="w-48 md:w-64 mb-2 drop-shadow-2xl hover:scale-105 transition-transform duration-500"
            />

            <div className="flex justify-center">
              <Link to="/charities" className="bg-white text-jaguar-green hover:bg-gray-100 px-8 py-3 rounded-none uppercase tracking-widest font-black text-xs transition-colors flex items-center gap-3 w-fit">
                Our Mission
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6 h-full">
          <div className="flex-1 bg-white rounded-xl p-8 border-t-4 border-trophy-gold flex flex-col justify-center relative overflow-hidden shadow-md">
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4 text-jaguar-green/80">
                <span className="material-symbols-outlined">volunteer_activism</span>
                <span className="text-xs font-black uppercase tracking-widest">Total Impact</span>
              </div>
              <p className="text-6xl font-serif font-bold text-trophy-gold tracking-tight">£142.5k</p>
              <div className="w-12 h-1 bg-jaguar-green mt-4 mb-4"></div>
              <p className="text-midnight-navy font-medium leading-relaxed text-sm">
                Raised for local charities and community projects since our inception.
              </p>
            </div>
          </div>

          {/* Featured Event Card (Charity Day) */}
          <div className="bg-midnight-navy text-white rounded-xl p-8 flex flex-col justify-center shadow-md relative overflow-hidden border-t-4 border-jaguar-green">
            <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#C5A059_1px,transparent_1px)] [background-size:16px_16px]"></div>
            <div className="relative z-10">
              <div className="flex justify-between items-end mb-6 border-b border-white/10 pb-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-trophy-gold uppercase tracking-widest mb-1">Featured Event</span>
                  <span className="text-lg font-serif">{featuredEvent.date}</span>
                </div>
                <span className="material-symbols-outlined text-trophy-gold">flag</span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="text-2xl font-serif font-bold text-white leading-tight">
                  {featuredEvent.event}
                </div>
                <div className="text-sm text-gray-300 font-medium">
                  {featuredEvent.venue}
                </div>
                <div className="flex items-center gap-2 text-trophy-gold text-xs uppercase tracking-wider mt-4">
                  <span className="w-2 h-2 rounded-full bg-trophy-gold animate-pulse"></span>
                  Cost: {featuredEvent.cost} (Full Package)
                </div>
              </div>

              <Link to="/events">
                <button className="w-full mt-8 bg-jaguar-green text-white py-3 rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-[#00331f] transition-colors border border-white/10">
                  View Details
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Society Objectives Section */}
      <div className="mb-16">
        <SocietyObjectives />
      </div>

      {/* Committee Section */}
      <div>
        <Committee />
      </div>
    </MainLayout>
  );
}
