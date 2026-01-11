import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop'; // We'll create a simple scroll to top component
import Home from './pages/Home';
import About from './pages/About';
import CharityEvents from './pages/CharityEvents';
import Donate from './pages/Donate';
import Charities from './pages/Charities';
import Sponsorship from './pages/Sponsorship';
import Leaderboards from './pages/Leaderboards';
import Gallery from './pages/Gallery';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Admin from './pages/Admin';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <CharityEvents />
              </ProtectedRoute>
            }
          />
          <Route path="/donate" element={<Donate />} />
          <Route path="/charities" element={<Charities />} />
          <Route path="/sponsorship" element={<Sponsorship />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/leaderboards" element={<Leaderboards />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
