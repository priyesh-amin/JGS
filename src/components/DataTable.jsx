import React, { useState } from 'react';

/**
 * Reusable branded data table for the Members Portal.
 *
 * Props:
 *   - data: Array of row objects
 *   - columns: Array of column header strings
 *   - headerColor: Tailwind bg class for the header bar (e.g. 'bg-jaguar-green')
 *   - headerTextColor: Tailwind text class (default 'text-white')
 *   - accentBorder: Tailwind border class for top accent (e.g. 'border-trophy-gold')
 *   - icon: Material Symbols icon name
 *   - title: Table title string
 */
export default function DataTable({
    data = [],
    columns = [],
    headerColor = 'bg-jaguar-green',
    headerTextColor = 'text-white',
    accentBorder = 'border-trophy-gold',
    icon = 'table_chart',
    title = 'Data',
    tableHeaderClass = 'bg-surface-light',
    getRowClassName = () => ''
}) {
    if (!data.length || !columns.length) {
        return (
            <div className="bg-white rounded-xl shadow-md border border-border-light p-12 text-center">
                <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">info</span>
                <p className="text-gray-500 font-medium">No data available.</p>
            </div>
        );
    }

    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    const sortedData = React.useMemo(() => {
        let sortableItems = [...data];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aVal = a[sortConfig.key] || '';
                let bVal = b[sortConfig.key] || '';
                
                // Sort algorithm handling numeric financial strings properly
                const parseNum = (val) => {
                    if (typeof val !== 'string') return isNaN(val) ? 0 : val;
                    let clean = val.trim().replace(/[£$,\s]/g, '');
                    if (clean.startsWith('(') && clean.endsWith(')')) clean = '-' + clean.slice(1, -1);
                    return Number(clean);
                };

                const aNum = parseNum(aVal);
                const bNum = parseNum(bVal);

                if (!isNaN(aNum) && !isNaN(bNum) && !(aVal==='' && bVal==='')) {
                    aVal = aNum;
                    bVal = bNum;
                } else if (typeof aVal === 'string' && typeof bVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [data, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    return (
        <div className={`bg-white rounded-xl shadow-lg overflow-hidden border-t-4 ${accentBorder} border border-border-light`}>
            {/* Header Bar */}
            <div className={`${headerColor} px-6 py-5 flex items-center gap-3`}>
                <span className={`material-symbols-outlined text-2xl ${headerTextColor === 'text-white' ? 'text-trophy-gold' : headerTextColor}`}>
                    {icon}
                </span>
                <h2 className={`text-xl font-serif font-bold ${headerTextColor}`}>{title}</h2>
                <span className={`ml-auto text-xs font-bold uppercase tracking-widest ${headerTextColor} opacity-60`}>
                    {data.length} {data.length === 1 ? 'record' : 'records'}
                </span>
            </div>

            {/* Scrollable Table */}
            <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
                <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead className={`sticky top-0 z-10 shadow-sm ${tableHeaderClass}`}>
                        <tr className="border-b-2 border-border-light">
                            {columns.map((col, idx) => (
                                <th
                                    key={idx}
                                    onClick={() => requestSort(col)}
                                    className="py-3 px-5 text-[11px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap cursor-pointer hover:bg-black/5 select-none transition-colors"
                                >
                                    <div className="flex items-center gap-1">
                                        {col}
                                        <span className="material-symbols-outlined text-[14px]">
                                            {sortConfig.key === col ? (sortConfig.direction === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light">
                        {sortedData.map((row, rowIdx) => (
                            <tr
                                key={rowIdx}
                                className={`transition-colors group hover:bg-black/5 ${getRowClassName(row, rowIdx) || ''}`}
                            >
                                {columns.map((col, colIdx) => {
                                    const value = row[col] || '';
                                    const isFirst = colIdx === 0;

                                    // Dynamic formatting for financial data based on user request
                                    let cellClasses = isFirst 
                                        ? 'font-bold text-midnight-navy' 
                                        : 'text-gray-700 font-medium';
                                        
                                    if (typeof value === 'string' && value.trim() !== '') {
                                        const cleanVal = value.trim();
                                        const isFinancial = col.toLowerCase().includes('balance') 
                                            || cleanVal.includes('£')
                                            || /^\(?[£$]?\s*-?[\d,]+\.\d{2}\)?$/.test(cleanVal);
                                        
                                        if (isFinancial) {
                                            // Parse the string into a number: handle (100) and -£100
                                            let numStr = cleanVal.replace(/[£$,\s]/g, '');
                                            if (numStr.startsWith('(') && numStr.endsWith(')')) {
                                                numStr = '-' + numStr.slice(1, -1);
                                            }
                                            const num = parseFloat(numStr);
                                            
                                            if (!isNaN(num)) {
                                                if (num < 0) {
                                                    cellClasses = 'text-red-600 font-bold'; // Owe
                                                } else if (num > 0) {
                                                    cellClasses = 'text-green-600 font-bold'; // Credit
                                                } else {
                                                    cellClasses = 'text-gray-300 font-medium'; // Zero ("white" / invisible)
                                                }
                                            }
                                        }
                                    }

                                    return (
                                        <td
                                            key={colIdx}
                                            className={`py-3 px-5 text-sm whitespace-nowrap ${cellClasses}`}
                                        >
                                            {value}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
