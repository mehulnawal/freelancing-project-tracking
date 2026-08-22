const safe = (value) => { const text = String(value ?? ''); const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${guarded.replaceAll('"', '""')}"` }
export const csvText = (headers, rows) => [headers.map(safe).join(','), ...rows.map((row) => row.map(safe).join(','))].join('\n')
export const csvFilename = (prefix, name = '') => `${prefix}${name ? `_${name.replace(/[^a-z0-9]+/gi, '_')}` : ''}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`
