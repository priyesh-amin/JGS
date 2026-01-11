import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Footer() {
  const { isAdmin } = useAuth();

  return (
    <footer className="bg-jaguar-green text-white border-t border-trophy-gold py-12 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <img
            alt="Jaguar Golf Society Logo"
            className="h-16 w-auto object-contain"
            src="/images/logo-hero.png"
          />
          <div className="flex flex-col items-start">
            <span className="text-xl font-serif font-bold tracking-tight mb-1">
              Jaguar Golf Society
            </span>
            <div className="text-xs text-gray-300 font-light tracking-wide">
              © 2024 Jaguar Golf Society. All rights reserved.
            </div>
          </div>
        </div>
        <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-trophy-gold/80">
          {/* TODO: Update links when requirements are defined */}
          <Link to="#" className="hover:text-white transition-colors">
            Constitution
          </Link>
          <Link to="#" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link to="#" className="hover:text-white transition-colors">
            Contact Us
          </Link>
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
