import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import MainLayout from '../layouts/MainLayout';
import { safeInternalPath } from '../lib/navigation';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Default redirect to home if no specific destination was requested
    const from = safeInternalPath(location.state?.from?.pathname);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const user = await login(email, password);
            navigate(user.mustChangePassword ? '/account/security' : from, {
                replace: true,
                state: user.mustChangePassword ? { from: location.state?.from } : undefined,
            });
        } catch (loginError) {
            setError(loginError.message || 'Sign-in failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <MainLayout>
            <div className="min-h-[60vh] flex items-center justify-center bg-surface-light px-4 py-12 sm:px-6 lg:px-8">
                <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-lg border border-border-light">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-6xl text-jaguar-green mb-4">lock</span>
                        <h2 className="text-3xl font-serif font-black text-midnight-navy">Member Access</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Sign in with your individual member email to view and manage your bookings.
                        </p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="email" className="mb-2 block text-sm font-bold text-midnight-navy">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-jaguar-green sm:text-sm sm:leading-6"
                                    placeholder="member@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="mb-2 block text-sm font-bold text-midnight-navy">
                                    Password
                                </label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    autoComplete="current-password"
                                    className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-jaguar-green sm:text-sm sm:leading-6"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div role="alert" className="text-sm text-charity-crimson font-medium text-center bg-red-50 p-3 rounded">
                                {error}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="group relative flex w-full justify-center rounded-md bg-jaguar-green px-3 py-3 text-sm font-bold text-white uppercase tracking-wider hover:bg-green-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jaguar-green shadow-md transition-all active:scale-95"
                            >
                                {submitting ? 'Signing in…' : 'Sign in'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </MainLayout>
    );
}
