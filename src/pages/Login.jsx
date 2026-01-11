import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainLayout from '../layouts/MainLayout';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Default redirect to home if no specific destination was requested
    const from = location.state?.from?.pathname || '/events';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const success = await login(username, password);
            if (success) {
                navigate(from, { replace: true });
            } else {
                setError('Invalid credentials. Please try member login again.');
            }
        } catch (err) {
            setError('Login failed. Please try again.');
        }
    };

    return (
        <MainLayout>
            <div className="min-h-[60vh] flex items-center justify-center bg-surface-light px-4 py-12 sm:px-6 lg:px-8">
                <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-lg border border-border-light">
                    <div className="text-center">
                        <span className="material-symbols-outlined text-6xl text-jaguar-green mb-4">lock</span>
                        <h2 className="text-3xl font-serif font-black text-midnight-navy">Member Access</h2>
                        <p className="mt-2 text-sm text-text-light">
                            Please sign in to view the season fixtures.
                        </p>
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="username" className="sr-only">Username</label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-jaguar-green sm:text-sm sm:leading-6"
                                    placeholder="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                            <div>
                                <label htmlFor="password" className="sr-only">Password</label>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-jaguar-green sm:text-sm sm:leading-6"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-sm text-charity-crimson font-medium text-center bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                className="group relative flex w-full justify-center rounded-md bg-jaguar-green px-3 py-3 text-sm font-bold text-white uppercase tracking-wider hover:bg-green-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jaguar-green shadow-md transition-all active:scale-95"
                            >
                                Sign in
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </MainLayout>
    );
}
