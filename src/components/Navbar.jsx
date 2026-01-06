import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const getLinkClass = (path) => {
    const isActive = location.pathname === path;
    const baseClass = "text-sm font-bold uppercase tracking-wider transition-colors";
    const activeClass = "text-trophy-gold";
    const inactiveClass = "text-white/80 hover:text-trophy-gold";

    return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
  };

  const getMobileLinkClass = (path) => {
    const isActive = location.pathname === path;
    const baseClass = "block px-3 py-2 text-base font-medium";
    const activeClass = "text-trophy-gold bg-black/10";
    const inactiveClass = "text-white hover:text-trophy-gold";

    return `${baseClass} ${isActive ? activeClass : inactiveClass}`;
  }

  return (
    <nav className="sticky top-0 z-50 bg-jaguar-green text-white shadow-md border-b-4 border-trophy-gold w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center justify-center">
              <img
                alt="Jaguar Golf Society Logo"
                className="h-16 w-auto object-contain"
                src="/logo.png"
              />
            </Link>
            <div className="flex flex-col">
              <span className="text-2xl font-serif font-bold tracking-tight text-white leading-none">
                Jaguar
              </span>
              <span className="text-xs font-sans tracking-[0.2em] text-trophy-gold uppercase font-bold">
                Golf Society
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className={getLinkClass('/')}>
              Home
            </Link>
            <Link to="/events" className={getLinkClass('/events')}>
              Fixtures
            </Link>
            <Link to="#" className={getLinkClass('/leaderboards')}>
              Leaderboards
            </Link>
            <Link to="/charities" className={getLinkClass('/charities')}>
              Charity
            </Link>
            <Link to="/about" className={getLinkClass('/about')}>
              About
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/donate">
              <button className="hidden sm:flex bg-trophy-gold hover:bg-yellow-600 text-jaguar-green px-6 py-3 rounded-none uppercase tracking-wider text-xs font-black transition-all shadow-lg hover:shadow-xl">
                Donate Now
              </button>
            </Link>
            <button
              className="md:hidden p-2 text-white"
              onClick={() => setIsOpen(!isOpen)}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
          </div>
        </div>
      </div>
      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-jaguar-green border-t border-white/10">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/" className={getMobileLinkClass('/')} onClick={() => setIsOpen(false)}>Home</Link>
            <Link to="/events" className={getMobileLinkClass('/events')} onClick={() => setIsOpen(false)}>Fixtures</Link>
            <Link to="/charities" className={getMobileLinkClass('/charities')} onClick={() => setIsOpen(false)}>Charity</Link>
            <Link to="/donate" className={getMobileLinkClass('/donate')} onClick={() => setIsOpen(false)}>Donate</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
