import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const result = await api.get('/api/auth/session');
      setUser(result.user);
      return result.user;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        console.error('Session check failed', error);
      }
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email, password) => {
    const result = await api.post('/api/auth/login', { email, password });
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const result = await api.post('/api/auth/change-password', {
      currentPassword,
      newPassword,
    });
    setUser(result.user);
    return result.user;
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'admin',
    login,
    logout,
    changePassword,
    refreshSession,
  }), [user, loading, login, logout, changePassword, refreshSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
