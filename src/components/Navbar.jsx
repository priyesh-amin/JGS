import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

const PUBLIC_LINKS = [
  ['/', 'Home'],
  ['/leaderboards', 'Leaderboards'],
  ['/charities', 'Charity'],
  ['/sponsorship', 'Sponsors'],
  ['/gallery', 'Gallery'],
  ['/about', 'About'],
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, user, logout } = useAuth();

  const isActive = (path) => path === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(path);
  const desktopClass = (path) => `text-sm font-bold uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trophy-gold ${
    isActive(path) ? 'text-trophy-gold' : 'text-white/80 hover:text-trophy-gold'
  }`;
  const mobileClass = (path) => `block rounded px-3 py-3 text-base font-bold ${
    isActive(path) ? 'bg-black/10 text-trophy-gold' : 'text-white hover:text-trophy-gold'
  }`;

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
      setIsOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b-4 border-trophy-gold bg-jaguar-green text-white shadow-md" aria-label="Primary navigation">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-24 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trophy-gold">
            <img
              alt="Jaguar Golf Society"
              className="h-16 w-auto object-contain"
              src="/images/Jaguar%20GS%20Logo%20.png"
            />
            <span className="hidden flex-col sm:flex">
              <span className="text-2xl font-serif font-bold leading-none">Jaguar</span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-trophy-gold">Golf Society</span>
            </span>
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {PUBLIC_LINKS.map(([path, label]) => (
              <Link key={path} to={path} className={desktopClass(path)}>{label}</Link>
            ))}
            {isAuthenticated && <Link to="/events" className={desktopClass('/events')}>Fixtures</Link>}
            {isAuthenticated && <Link to="/members" className={desktopClass('/members')}>Members</Link>}
            {isAdmin && <Link to="/admin" className={desktopClass('/admin')}>Admin</Link>}
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="hidden items-center gap-3 sm:flex">
                <Link to="/account/security" className="max-w-40 truncate text-right text-xs font-bold text-white/90 hover:text-trophy-gold">
                  <span className="block text-[9px] uppercase tracking-wider text-trophy-gold">Signed in</span>
                  {user.displayName}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="min-h-11 rounded border border-white/30 px-3 py-2 text-xs font-black uppercase tracking-wider hover:bg-white/10 disabled:opacity-60"
                >
                  {signingOut ? 'Leaving…' : 'Sign out'}
                </button>
              </div>
            ) : (
              <Link to="/login" className="hidden min-h-11 items-center rounded bg-trophy-gold px-5 py-3 text-xs font-black uppercase tracking-wider text-jaguar-green sm:inline-flex">
                Member sign in
              </Link>
            )}
            <button
              type="button"
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isOpen}
              className="grid min-h-11 min-w-11 place-items-center rounded lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-trophy-gold"
              onClick={() => setIsOpen((open) => !open)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{isOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-white/10 bg-jaguar-green lg:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 py-4">
            {PUBLIC_LINKS.map(([path, label]) => (
              <Link key={path} to={path} className={mobileClass(path)} onClick={() => setIsOpen(false)}>{label}</Link>
            ))}
            {isAuthenticated && <Link to="/events" className={mobileClass('/events')} onClick={() => setIsOpen(false)}>Fixtures</Link>}
            {isAuthenticated && <Link to="/members" className={mobileClass('/members')} onClick={() => setIsOpen(false)}>Members</Link>}
            {isAdmin && <Link to="/admin" className={mobileClass('/admin')} onClick={() => setIsOpen(false)}>Admin dashboard</Link>}
            {isAuthenticated ? (
              <div className="mt-3 border-t border-white/10 pt-3">
                <Link to="/account/security" className={mobileClass('/account/security')} onClick={() => setIsOpen(false)}>
                  Account: {user.displayName}
                </Link>
                <button type="button" onClick={handleLogout} disabled={signingOut} className="min-h-11 w-full rounded px-3 py-3 text-left font-bold text-red-200 hover:bg-black/10">
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            ) : (
              <Link to="/login" className="mt-3 block min-h-11 rounded bg-trophy-gold px-4 py-3 text-center font-black uppercase tracking-wider text-jaguar-green" onClick={() => setIsOpen(false)}>
                Member sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

