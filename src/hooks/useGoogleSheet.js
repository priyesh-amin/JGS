import { useState, useEffect, useCallback } from 'react';

/**
 * Reusable hook to fetch and parse CSV data from a Google Sheet.
 *
 * Usage:
 *   const { data, columns, loading, error, refetch } = useGoogleSheet(spreadsheetId, gid);
 *
 * Requirements:
 *   - Sheet must be shared as "Anyone with the link can view"
 *   - Uses the public CSV export endpoint
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(spreadsheetId, gid) {
    return `jgs_sheet_${spreadsheetId}_${gid}`;
}

function getCachedData(key) {
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
            sessionStorage.removeItem(key);
            return null;
        }
        return cached;
    } catch {
        return null;
    }
}

function setCachedData(key, data, columns) {
    try {
        sessionStorage.setItem(key, JSON.stringify({
            data,
            columns,
            timestamp: Date.now()
        }));
    } catch {
        // sessionStorage full or unavailable — non-critical
    }
}

function parseCSV(text, customHeaders = null) {
    if (!text || !text.trim()) return { raw: [], data: [], columns: [] };

    let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
    for (l of text) {
        if ('"' === l) {
            if (s && l === p) row[i] += l;
            s = !s;
        } else if (',' === l && s) l = row[++i] = '';
        else if ('\n' === l && s) {
            if ('\r' === p) row[i] = row[i].slice(0, -1);
            row = ret[++r] = [l = '']; i = 0;
        } else row[i] += l;
        p = l;
    }

    if (ret.length === 0) return { data: [], columns: [] };

    // the last row might be empty due to trailing newline
    if (ret[ret.length - 1].length === 1 && ret[ret.length - 1][0] === '') {
        ret.pop();
    }

    let headers;
    let startIndex = 1;
    
    if (customHeaders && Array.isArray(customHeaders)) {
        headers = customHeaders;
        startIndex = 0; // First row is data
    } else {
        headers = ret[0].map(h => h.replace(/^\uFEFF/, '').trim());
    }
    
    const data = [];
    for (let rowIndex = startIndex; rowIndex < ret.length; rowIndex++) {
        const values = ret[rowIndex];
        // skip completely empty rows
        if (values.length === 1 && !values[0].trim()) continue;
        
        const rowObj = {};
        headers.forEach((col, idx) => {
            rowObj[col] = (values[idx] || '').trim();
        });
        data.push(rowObj);
    }

    return { raw: ret, data, columns: headers };
}

export default function useGoogleSheet(spreadsheetId, gid = null, customHeaders = null) {
    const [raw, setRaw] = useState([]);
    const [data, setData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const cacheKey = getCacheKey(spreadsheetId, gid || 'default');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        // Check cache first
        const cached = getCachedData(cacheKey);
        if (cached) {
            setRaw(cached.raw || []);
            setData(cached.data);
            setColumns(cached.columns);
            setLoading(false);
            return;
        }

        try {
            const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('This spreadsheet is not publicly accessible. Please contact an administrator.');
                }
                throw new Error(`Failed to load data (HTTP ${response.status})`);
            }

            const csvText = await response.text();
            const { raw: rawParsed, data: parsed, columns: cols } = parseCSV(csvText, customHeaders);

            setRaw(rawParsed);
            setData(parsed);
            setColumns(cols);
            
            setCachedData(cacheKey, parsed, cols);
        } catch (err) {
            setError(err.message || 'Failed to load data. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [spreadsheetId, gid, cacheKey, customHeaders]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { raw, data, columns, loading, error, refetch: fetchData };
}
