import React, { useState, useEffect } from 'react';
import MainLayout from '../layouts/MainLayout';
import DataTable from '../components/DataTable';
import HandicapTable from '../components/HandicapTable';
import useGoogleSheet from '../hooks/useGoogleSheet';
import { useAuth } from '../contexts/AuthContext';

// --- Sheet Configuration ---
const SHEETS = [
    {
        id: 'balance',
        label: 'Balance',
        icon: 'account_balance_wallet',
        spreadsheetId: '1DRIEyRke1xsJ4QpS5Tpnp25gEHa8Ce48CboyCTibqzA',
        customHeaders: ['Name', 'Amount Owed'],
        headerColor: 'bg-jaguar-green',
        headerTextColor: 'text-white',
        accentBorder: 'border-trophy-gold',
        editUrl: 'https://docs.google.com/spreadsheets/d/1DRIEyRke1xsJ4QpS5Tpnp25gEHa8Ce48CboyCTibqzA/edit',
    },
    {
        id: 'handicap',
        label: 'Handicap Index',
        icon: 'sports_golf',
        spreadsheetId: '11onOylPWWGTH2pHKZhu9-j6TDBu8XiKzeRlnD4vr1ys',
        headerColor: 'bg-midnight-navy',
        headerTextColor: 'text-white',
        accentBorder: 'border-trophy-gold',
        editUrl: 'https://docs.google.com/spreadsheets/d/11onOylPWWGTH2pHKZhu9-j6TDBu8XiKzeRlnD4vr1ys/edit',
    },
    {
        id: 'singles',
        label: 'Singles Match Play',
        icon: 'emoji_events',
        spreadsheetId: '1ZU3FaafiE50C9YPDT5fY8qLMOvIUDuu18vtvrYAh_ZE',
        headerColor: 'bg-midnight-navy',
        headerTextColor: 'text-white',
        accentBorder: 'border-charity-crimson',
        tableHeaderClass: 'bg-[#ffff00]',
        getRowClassName: (row) => {
            const r = row['Round'] || '';
            if (r.startsWith('R1') || r.startsWith('R3') || r.startsWith('SF')) return 'bg-[#f4cccc] hover:bg-[#ea9999] text-gray-900';
            if (r.startsWith('R2') || r.startsWith('QF')) return 'bg-[#cfe2f3] hover:bg-[#9fc5e8] text-gray-900';
            if (r.startsWith('Final')) return 'bg-[#d9ead3] hover:bg-[#b6d7a8] text-green-950 font-bold';
            return '';
        },
        editUrl: 'https://docs.google.com/spreadsheets/d/1ZU3FaafiE50C9YPDT5fY8qLMOvIUDuu18vtvrYAh_ZE/edit',
    },
    {
        id: 'doubles',
        label: 'Doubles Match Play',
        icon: 'group',
        spreadsheetId: '1fhGDgdQ099mGIwpFqEpk2jdjuxeerNTWoHgl7-6gXt0',
        headerColor: 'bg-charity-crimson',
        headerTextColor: 'text-white',
        accentBorder: 'border-midnight-navy',
        tableHeaderClass: 'bg-[#e2e3e3]',
        getRowClassName: (row) => {
            const m = row['Match ID'] || '';
            if (m.startsWith('D-R1')) return 'bg-[#d5a6bd] hover:bg-[#c27ba0] text-gray-900';
            if (m.startsWith('QF')) return 'bg-[#ffe599] hover:bg-[#ffd966] text-gray-900';
            if (m.startsWith('SF')) return 'bg-[#cfe2f3] hover:bg-[#9fc5e8] text-gray-900';
            if (m.startsWith('Final')) return 'bg-[#93c47d] hover:bg-[#6aa84f] text-green-950 font-bold';
            return '';
        },
        editUrl: 'https://docs.google.com/spreadsheets/d/1fhGDgdQ099mGIwpFqEpk2jdjuxeerNTWoHgl7-6gXt0/edit',
    },
];

// --- Individual Tab Content ---
function SheetTab({ sheet }) {
    const { raw, data, columns, loading, error, refetch } = useGoogleSheet(sheet.spreadsheetId, sheet.gid, sheet.customHeaders);
    const { isAdmin } = useAuth();

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="h-14 bg-gray-200 rounded-xl w-full" />
                <div className="h-8 bg-gray-100 rounded w-full" />
                {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="h-10 bg-gray-50 rounded w-full" />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-xl shadow-lg border border-border-light p-10 text-center">
                <span className="material-symbols-outlined text-5xl text-charity-crimson mb-4 block">error</span>
                <h3 className="text-xl font-serif font-bold text-midnight-navy mb-2">Unable to Load Data</h3>
                <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">{error}</p>
                <button
                    onClick={refetch}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-jaguar-green text-white font-bold text-xs uppercase tracking-widest rounded-lg shadow-md hover:bg-green-900 transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined text-lg">refresh</span>
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Admin Edit Button */}
            {isAdmin && (
                <div className="flex items-center justify-between bg-midnight-navy/5 border border-midnight-navy/10 rounded-lg px-5 py-3">
                    <div className="flex items-center gap-2 text-sm text-midnight-navy">
                        <span className="material-symbols-outlined text-lg text-trophy-gold">admin_panel_settings</span>
                        <span className="font-medium">Admin Mode</span>
                        <span className="text-gray-500 hidden sm:inline">— Edit this data directly in Google Sheets</span>
                    </div>
                    <a
                        href={sheet.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-jaguar-green text-white font-bold text-[11px] uppercase tracking-widest rounded shadow-md hover:bg-green-900 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-base">edit</span>
                        Edit in Google Sheets
                        <span className="material-symbols-outlined text-base">open_in_new</span>
                    </a>
                </div>
            )}

            {sheet.id === 'handicap' ? (
                <HandicapTable
                    raw={raw}
                    title={sheet.label}
                    headerColor={sheet.headerColor}
                    headerTextColor={sheet.headerTextColor}
                    accentBorder={sheet.accentBorder}
                    icon={sheet.icon}
                />
            ) : (
                <DataTable
                    data={data}
                    columns={columns}
                    headerColor={sheet.headerColor}
                    headerTextColor={sheet.headerTextColor}
                    accentBorder={sheet.accentBorder}
                    icon={sheet.icon}
                    title={sheet.label}
                    tableHeaderClass={sheet.tableHeaderClass}
                    getRowClassName={sheet.getRowClassName}
                />
            )}
        </div>
    );
}

// --- Main Page ---
export default function MembersPortal() {
    // Read active tab from URL hash, default to first sheet
    const getInitialTab = () => {
        const hash = window.location.hash.replace('#', '');
        const found = SHEETS.find(s => s.id === hash);
        return found ? found.id : SHEETS[0].id;
    };

    const [activeTab, setActiveTab] = useState(getInitialTab);

    // Update URL hash when tab changes
    useEffect(() => {
        window.location.hash = activeTab;
    }, [activeTab]);

    const activeSheet = SHEETS.find(s => s.id === activeTab);

    return (
        <MainLayout>
            <div className="w-full max-w-[1280px] flex flex-col gap-8 mx-auto">

                {/* Page Header */}
                <div className="flex flex-col gap-4 border-l-4 border-trophy-gold pl-6 py-2">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-3xl text-jaguar-green">lock_person</span>
                        <div>
                            <h1 className="text-4xl md:text-5xl font-serif font-black leading-tight text-jaguar-green">
                                Members Portal
                            </h1>
                            <p className="text-midnight-navy text-lg font-medium mt-1 max-w-2xl leading-relaxed">
                                Your society data, updated in real-time from the committee's records.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white rounded-xl shadow-md border border-border-light overflow-hidden">
                    <div className="flex overflow-x-auto scrollbar-hide">
                        {SHEETS.map((sheet) => {
                            const isActive = activeTab === sheet.id;
                            return (
                                <button
                                    key={sheet.id}
                                    onClick={() => setActiveTab(sheet.id)}
                                    className={`
                                        flex items-center gap-2.5 px-6 py-4 text-sm font-bold uppercase tracking-wider
                                        whitespace-nowrap transition-all duration-200 border-b-[3px] flex-1 justify-center
                                        ${isActive
                                            ? 'border-trophy-gold text-jaguar-green bg-surface-light'
                                            : 'border-transparent text-gray-400 hover:text-midnight-navy hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    <span className={`material-symbols-outlined text-xl ${isActive ? 'text-trophy-gold' : 'text-gray-300'}`}>
                                        {sheet.icon}
                                    </span>
                                    <span className="hidden sm:inline">{sheet.label}</span>
                                    {/* Mobile: shorter labels */}
                                    <span className="sm:hidden">
                                        {sheet.id === 'balance' && 'Balance'}
                                        {sheet.id === 'handicap' && 'HCP'}
                                        {sheet.id === 'singles' && 'Singles'}
                                        {sheet.id === 'doubles' && 'Doubles'}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Active Tab Content */}
                <div className="min-h-[400px]">
                    <SheetTab key={activeSheet.id} sheet={activeSheet} />
                </div>

                {/* Footer Note */}
                <div className="text-center text-xs text-gray-400 uppercase tracking-widest pb-4">
                    <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
                    Data sourced from committee records · Refreshes on each visit
                </div>
            </div>
        </MainLayout>
    );
}
