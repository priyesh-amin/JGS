import React from 'react';

/**
 * Bespoke renderer for the Handicap Index sheet which has a 3-category layout.
 */
const getHandicapClasses = (valStr) => {
    if (!valStr || valStr.trim() === '') return '';
    const val = parseFloat(valStr);
    if (isNaN(val)) return '';
    if (val <= 18.0) return 'bg-[#b6d7a8] text-green-900';
    if (val <= 23.9) return 'bg-[#ffe599] text-yellow-900';
    return 'bg-[#ea9999] text-red-900';
};

export default function HandicapTable({ raw = [], title, headerColor, headerTextColor, accentBorder, icon }) {
    if (!raw || raw.length < 4) {
        return (
            <div className="bg-white rounded-xl shadow-md border border-border-light p-12 text-center">
                <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">info</span>
                <p className="text-gray-500 font-medium">No valid handicap data layout detected.</p>
            </div>
        );
    }

    const mainTitle = raw[0][0]; // "⛳ OFFICIAL CLUB HANDICAP CATEGORIES"
    const cat1 = raw[1][0]; // Elite
    const cat2 = raw[1][2]; // Competitive
    const cat3 = raw[1][4]; // Emerging

    // Data rows start from index 3 (0-indexed)
    const dataRows = raw.slice(3).filter(row => row.some(cell => cell.trim() !== ''));

    // Compute stats
    let totalPlayers = 0;
    dataRows.forEach(row => {
        if (row[0] && row[0].trim() !== '') totalPlayers++;
        if (row[2] && row[2].trim() !== '') totalPlayers++;
        if (row[4] && row[4].trim() !== '') totalPlayers++;
    });

    return (
        <div className={`bg-white rounded-xl shadow-lg overflow-hidden border-t-4 ${accentBorder} border border-border-light`}>
            {/* Header Bar */}
            <div className={`${headerColor} px-6 py-5 flex items-center gap-3`}>
                <span className={`material-symbols-outlined text-2xl ${headerTextColor === 'text-white' ? 'text-trophy-gold' : headerTextColor}`}>
                    {icon}
                </span>
                <h2 className={`text-xl font-serif font-bold ${headerTextColor}`}>{title || mainTitle}</h2>
                <span className={`ml-auto text-xs font-bold uppercase tracking-widest ${headerTextColor} opacity-60`}>
                    {totalPlayers} {totalPlayers === 1 ? 'member' : 'members'}
                </span>
            </div>

            {/* Scrollable Table */}
            <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="sticky top-0 z-10 shadow-sm bg-white">
                        {/* Title Row */}
                        <tr className="bg-gray-100 border-b border-gray-200">
                            <th colSpan="6" className="py-2 px-5 text-sm font-bold text-gray-700 text-center uppercase tracking-widest">
                                {mainTitle}
                            </th>
                        </tr>
                        {/* Categories Row */}
                        <tr className="border-b-2 border-border-light bg-surface-light text-center">
                            <th colSpan="2" className="py-3 px-5 text-sm font-bold tracking-wider text-green-900 border-r border-white w-1/3 bg-[#b6d7a8]">
                                {cat1}
                            </th>
                            <th colSpan="2" className="py-3 px-5 text-sm font-bold tracking-wider text-yellow-900 border-r border-white w-1/3 bg-[#ffe599]">
                                {cat2}
                            </th>
                            <th colSpan="2" className="py-3 px-5 text-sm font-bold tracking-wider text-red-900 w-1/3 bg-[#ea9999]">
                                {cat3}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                        {dataRows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="hover:bg-jaguar-green/5 transition-colors group">
                                {/* Cat 1 */}
                                <td className="py-3 px-5 text-sm font-medium text-gray-700">{row[0] || ''}</td>
                                <td className={`py-3 px-5 text-sm font-bold border-r border-gray-200 text-right ${getHandicapClasses(row[1])}`}>
                                    {row[1] || ''}
                                </td>
                                
                                {/* Cat 2 */}
                                <td className="py-3 px-5 text-sm font-medium text-gray-700 pl-6">{row[2] || ''}</td>
                                <td className={`py-3 px-5 text-sm font-bold border-r border-gray-200 text-right ${getHandicapClasses(row[3])}`}>
                                    {row[3] || ''}
                                </td>
                                
                                {/* Cat 3 */}
                                <td className="py-3 px-5 text-sm font-medium text-gray-700 pl-6">{row[4] || ''}</td>
                                <td className={`py-3 px-5 text-sm font-bold text-right ${getHandicapClasses(row[5])}`}>
                                    {row[5] || ''}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
