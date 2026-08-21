import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

export default function Footer() {
  const { isAdmin } = useAuth();

  return (
    <footer className="bg-jaguar-green text-white border-t border-trophy-gold py-12 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <img
            alt="Jaguar Golf Society Logo"
            className="h-16 w-auto object-contain"
            src="/images/Jaguar%20GS%20Logo%20.png"
          />
          <div className="flex flex-col items-start">
            <span className="text-xl font-serif font-bold tracking-tight mb-1">
              Jaguar Golf Society
            </span>
            <div className="text-xs text-gray-300 font-light tracking-wide">
              © {new Date().getFullYear()} Jaguar Golf Society. All rights reserved.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-5 text-xs font-bold uppercase tracking-widest text-trophy-gold/80">
          <span title="Not yet published">Constitution: unavailable</span>
          <span title="Not yet published">Privacy notice: unavailable</span>
          <span title="Public contact details are awaiting verification">Contact: committee</span>
          {isAdmin && (
            <Link to="/admin" className="hover:text-white transition-colors text-charity-crimson">
              Admin
            </Link>
          )}
        </div>
      </div>
      <div className="flex gap-4">
        {/* Social Icons would go here */}
      </div>
    </footer >
  );
}
