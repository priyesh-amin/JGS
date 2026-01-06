import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop'; // We'll create a simple scroll to top component
import Home from './pages/Home';
import About from './pages/About';
import CharityEvents from './pages/CharityEvents';
import Donate from './pages/Donate';
import Charities from './pages/Charities';
import Sponsorship from './pages/Sponsorship';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<CharityEvents />} />
        <Route path="/donate" element={<Donate />} />
        <Route path="/charities" element={<Charities />} />
        <Route path="/sponsorship" element={<Sponsorship />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  );
}

export default App;
