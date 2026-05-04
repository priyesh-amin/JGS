import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const signedInLabel = isAdmin ? 'Admin signed in' : 'Member signed in';

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

  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, success, error

  const handleSync = async () => {
    setSyncStatus('syncing');
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      if (response.ok) {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 5000);
      }
    } catch (err) {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const renderSignedInState = (mobile = false) => {
    if (!isAuthenticated) return null;

    let syncButtonText = 'SYNC DATA';
    if (syncStatus === 'syncing') syncButtonText = 'SYNCING...';
    if (syncStatus === 'success') syncButtonText = 'SYNC TRIGGERED!';
    if (syncStatus === 'error') syncButtonText = 'SYNC FAILED';

    return (
      <div className={`flex flex-col gap-0.5 ${mobile ? 'items-center text-center mx-auto mt-1 mb-2' : 'items-center text-center mt-1'}`}>
        <span className="text-[10px] font-black uppercase tracking-wider text-trophy-gold">
          {signedInLabel}
        </span>
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncStatus !== 'idle'}
            className="text-[9px] bg-black/30 hover:bg-black/50 text-white px-2 py-0.5 rounded border border-white/20 uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            {syncButtonText}
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              if (mobile) setIsOpen(false);
            }}
            className="text-[10px] text-charity-crimson font-black uppercase tracking-wider hover:text-red-400 text-center self-center"
          >
            LOGOUT
          </button>
        </div>
      </div>
    );
  };

  return (
    <nav className="sticky top-0 z-50 bg-jaguar-green text-white shadow-md border-b-4 border-trophy-gold w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center justify-center">
              <img
                alt="Jaguar Golf Society Logo"
                className="h-16 w-auto object-contain"
                src="/images/Jaguar%20GS%20Logo%20.png"
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

            <div className="flex flex-col items-center">
              <Link to="/events" className={getLinkClass('/events')}>
                Fixtures
              </Link>
              {isAdmin && (
                <Link to="/admin" className="block text-center text-[10px] text-trophy-gold font-bold uppercase tracking-wider hover:text-white mt-1 mb-0.5">
                  Admin Dashboard
                </Link>
              )}
            </div>

            <div className="flex flex-col items-center">
              <Link to="/members" className={getLinkClass('/members')}>
                Members
              </Link>
              {renderSignedInState()}
            </div>
            <Link to="/leaderboards" className={getLinkClass('/leaderboards')}>
              Leaderboards
            </Link>
            <Link to="/charities" className={getLinkClass('/charities')}>
              Charity
            </Link>
            <Link to="/sponsorship" className={getLinkClass('/sponsorship')}>
              Sponsors
            </Link>
            <Link to="/gallery" className={getLinkClass('/gallery')}>
              Gallery
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
            <Link to="/members" className={getMobileLinkClass('/members')} onClick={() => setIsOpen(false)}>Members</Link>
            {renderSignedInState(true)}
            {isAdmin && <Link to="/admin" className={getMobileLinkClass('/admin')} onClick={() => setIsOpen(false)}>Admin Dashboard</Link>}
            <Link to="/charities" className={getMobileLinkClass('/charities')} onClick={() => setIsOpen(false)}>Charity</Link>
            <Link to="/sponsorship" className={getMobileLinkClass('/sponsorship')} onClick={() => setIsOpen(false)}>Sponsors</Link>
            <Link to="/gallery" className={getMobileLinkClass('/gallery')} onClick={() => setIsOpen(false)}>Gallery</Link>
            <Link to="/about" className={getMobileLinkClass('/about')} onClick={() => setIsOpen(false)}>About</Link>
            <Link to="/donate" className={getMobileLinkClass('/donate')} onClick={() => setIsOpen(false)}>Donate</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
