import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import metadata from '../data/metadata.json'; // Import build-time (or locally synced) metadata

export default function Admin() {
    const { isAuthenticated } = useAuth();
    const [syncStatus, setSyncStatus] = useState('idle'); // idle, loading, success, error
    const [message, setMessage] = useState('');
    const [logs, setLogs] = useState([]);
    const [timeSinceUpdate, setTimeSinceUpdate] = useState('');

    const addLog = (text) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev]);
    };

    // calculate time ago
    useEffect(() => {
        if (metadata && metadata.lastUpdated) {
            const updateTime = () => {
                const now = new Date();
                const past = new Date(metadata.lastUpdated);
                const diffMs = now - past;
                const diffMins = Math.floor(diffMs / 60000);

                if (diffMins < 1) setTimeSinceUpdate('Just now');
                else if (diffMins === 1) setTimeSinceUpdate('1 minute ago');
                else if (diffMins < 60) setTimeSinceUpdate(`${diffMins} minutes ago`);
                else {
                    const diffHours = Math.floor(diffMins / 60);
                    setTimeSinceUpdate(`${diffHours} hours ago`);
                }
            };

            updateTime();
            const interval = setInterval(updateTime, 60000); // Update every minute
            return () => clearInterval(interval);
        }
    }, []);


    const handleSync = async () => {
        setSyncStatus('loading');
        setMessage('Initializing sync process...');
        addLog('Requesting sync via GitHub Actions...');

        try {
            const response = await fetch('/api/trigger-sync', {
                method: 'POST',
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to trigger sync');
            }

            setSyncStatus('success');
            setMessage('Sync Started!');
            addLog(data.message);
            addLog('NOTE: Changes will take ~2-3 minutes to appear on the live site.');

        } catch (err) {
            setSyncStatus('error');
            setMessage('Error: ' + err.message);
            addLog('Failed to trigger sync: ' + err.message);
        }
    };

    if (!isAuthenticated) {
        return (
            <MainLayout>
                <div className="text-center py-20">
                    <h1 className="text-2xl font-bold text-charity-crimson">Access Denied</h1>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-serif font-black text-midnight-navy mb-4">
                        Admin Dashboard
                    </h1>
                    <p className="text-text-light max-w-2xl mx-auto">
                        Manage website content and synchronize data from the Master Google Sheet.
                    </p>
                </div>

                {/* Content Sync Card */}
                <div className="bg-white rounded-xl shadow-lg border border-border-light overflow-hidden">
                    <div className="bg-midnight-navy p-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-trophy-gold text-3xl">sync</span>
                            <div>
                                <h2 className="text-xl font-bold text-white">Content Synchronization</h2>
                                <p className="text-white/60 text-xs uppercase tracking-widest">Master Sheet → Live Site</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                                <span className={`h-3 w-3 rounded-full ${syncStatus === 'loading' ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></span>
                                <span className="text-white/80 text-sm font-medium">System Ready</span>
                            </div>
                            {timeSinceUpdate && (
                                <div className="text-white/60 text-[10px] uppercase font-mono tracking-wider">
                                    Last Updated: <span className="text-trophy-gold">{timeSinceUpdate}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            <div className="flex-1 space-y-4">
                                <p className="text-text-dark">
                                    Click the button below to fetch the latest Fixtures, Leaderboards, and Event details from the Google Sheet and update the live website.
                                </p>
                                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
                                    <div className="flex">
                                        <div className="ml-3">
                                            <p className="text-sm text-blue-700">
                                                <strong>How it works:</strong> This triggers a background process on GitHub. The site will rebuild and redeploy automatically. Detailed logs are visible in the "Actions" tab of the repository.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSync}
                                    disabled={syncStatus === 'loading'}
                                    className={`
                                        w-full py-4 px-6 rounded-lg shadow-md uppercase tracking-wider font-black text-sm transition-all
                                        ${syncStatus === 'loading'
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-jaguar-green text-white hover:bg-green-900 hover:shadow-xl active:scale-95'}
                                    `}
                                >
                                    {syncStatus === 'loading' ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined animate-spin">refresh</span>
                                            Starting Sync...
                                        </span>
                                    ) : (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="material-symbols-outlined">cloud_sync</span>
                                            Publish Updates
                                        </span>
                                    )}
                                </button>

                                {message && (
                                    <div className={`text-center font-bold p-3 rounded ${syncStatus === 'error' ? 'text-charity-crimson bg-red-50' : 'text-green-700 bg-green-50'}`}>
                                        {message}
                                    </div>
                                )}
                            </div>

                            {/* Logs Terminal */}
                            <div className="w-full md:w-96 bg-gray-900 rounded-lg p-4 font-mono text-xs text-green-400 h-64 overflow-y-auto shadow-inner border border-gray-700">
                                <div className="border-b border-gray-700 pb-2 mb-2 text-gray-500 uppercase tracking-widest text-[10px] flex justify-between">
                                    <span>Activity Log</span>
                                    <span>TERM-01</span>
                                </div>
                                <div className="space-y-1">
                                    {logs.length === 0 && <span className="text-gray-600 opacity-50">Waiting for command...</span>}
                                    {logs.map((log, i) => (
                                        <div key={i} className="break-all">
                                            <span className="text-gray-500 mr-2">$</span>
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
