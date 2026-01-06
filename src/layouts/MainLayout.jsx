import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function MainLayout({ children }) {
  return (
    <div className="bg-fairway-mist text-midnight-navy min-h-screen flex flex-col selection:bg-trophy-gold selection:text-white">
      <Navbar />
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
