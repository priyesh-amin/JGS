import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Initialize from sessionStorage to persist login during refresh
    const [isAuthenticated, setIsAuthenticated] = useState(() => {
        return sessionStorage.getItem('jgs_auth') === 'true';
    });

    // Hashes for 'Jaguargs' and 'sindoor2025'
    const USER_HASH = '194679d74833f1d73fd15e84e9aa61c29bb2188b23a514fc5b8ac18af6b8da3f';
    const PASS_HASH = 'cc83243c0f4f8561c73d3db6e8a60faa49bb1364d517007f1e644c3099e4a9c9';

    // Helper to hash input
    const sha256 = async (message) => {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const login = async (username, password) => {
        const inputUserHash = await sha256(username);
        const inputPassHash = await sha256(password);

        if (inputUserHash === USER_HASH && inputPassHash === PASS_HASH) {
            setIsAuthenticated(true);
            sessionStorage.setItem('jgs_auth', 'true');
            return true;
        }
        return false;
    };

    const logout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem('jgs_auth');
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
