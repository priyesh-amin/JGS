import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Initialize state from sessionStorage
    // Storing 'role' instead of just boolean
    const [user, setUser] = useState(() => {
        const storedRole = sessionStorage.getItem('jgs_role');
        return storedRole ? { role: storedRole } : null;
    });

    // MEMBER Credentials (Jaguargs / sindoor2025)
    const MEMBER_USER_HASH = '194679d74833f1d73fd15e84e9aa61c29bb2188b23a514fc5b8ac18af6b8da3f';
    const MEMBER_PASS_HASH = 'cc83243c0f4f8561c73d3db6e8a60faa49bb1364d517007f1e644c3099e4a9c9';

    // ADMIN Credentials (JGSAdmin / masterkey2026)
    const ADMIN_USER_HASH = 'd1499a8a7074b7abf967bb5c98616a1abcbe7f5a9bab600ceb907a95915c7a71';
    const ADMIN_PASS_HASH = '3b50668c26a3abe701faf5dad1b7612311a49e01c2c186d37d317c96e05a1025';

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

        // Check Admin
        if (inputUserHash === ADMIN_USER_HASH && inputPassHash === ADMIN_PASS_HASH) {
            const userData = { role: 'admin' };
            setUser(userData);
            sessionStorage.setItem('jgs_role', 'admin');
            return true;
        }

        // Check Member
        if (inputUserHash === MEMBER_USER_HASH && inputPassHash === MEMBER_PASS_HASH) {
            const userData = { role: 'member' };
            setUser(userData);
            sessionStorage.setItem('jgs_role', 'member');
            return true;
        }

        return false;
    };

    const logout = () => {
        setUser(null);
        sessionStorage.removeItem('jgs_role');
    };

    // Derived states
    const isAuthenticated = !!user;
    const isAdmin = user?.role === 'admin';

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, isAdmin, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
