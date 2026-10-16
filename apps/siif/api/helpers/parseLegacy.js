// ─── Legacy Value Parsers ─────────────────────────────────────────────────────
// The 2026-09 restore of siif_database_v2 stored structured columns as text in
// Python repr form (e.g. "['a', 'b']", "{'Math': '13'}") and booleans as 0/1.
// These helpers read every known shape — JSON, Python repr, Postgres array
// literal — and never throw: unparseable values fall back to a safe default.

/**
 * Parse a Python literal (list / dict / tuple / str / number / True / False / None).
 * Returns undefined when the input is not a valid Python literal.
 */
function parsePythonLiteral(src) {
    let i = 0;
    const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };

    const parseString = () => {
        const quote = src[i++];
        let out = '';
        while (i < src.length && src[i] !== quote) {
            if (src[i] === '\\' && i + 1 < src.length) {
                const next = src[i + 1];
                const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"' };
                out += map[next] ?? next;
                i += 2;
            } else {
                out += src[i++];
            }
        }
        if (src[i] !== quote) throw new Error('unterminated string');
        i++;
        return out;
    };

    const parseSeq = (close) => {
        i++;
        const items = [];
        ws();
        while (src[i] !== close) {
            items.push(parseValue());
            ws();
            if (src[i] === ',') { i++; ws(); continue; }
            if (src[i] !== close) throw new Error('expected separator');
        }
        i++;
        return items;
    };

    const parseDict = () => {
        i++;
        const obj = {};
        ws();
        while (src[i] !== '}') {
            const key = parseValue();
            ws();
            if (src[i++] !== ':') throw new Error('expected colon');
            obj[String(key)] = parseValue();
            ws();
            if (src[i] === ',') { i++; ws(); continue; }
            if (src[i] !== '}') throw new Error('expected separator');
        }
        i++;
        return obj;
    };

    const parseValue = () => {
        ws();
        const ch = src[i];
        if (ch === "'" || ch === '"') return parseString();
        if (ch === '[') return parseSeq(']');
        if (ch === '(') return parseSeq(')');
        if (ch === '{') return parseDict();
        const rest = src.slice(i);
        const word = rest.match(/^(True|False|None|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
        if (!word) throw new Error('unexpected token');
        i += word[0].length;
        if (word[0] === 'True') return true;
        if (word[0] === 'False') return false;
        if (word[0] === 'None') return null;
        return Number(word[0]);
    };

    try {
        const value = parseValue();
        ws();
        return i === src.length ? value : undefined;
    } catch {
        return undefined;
    }
}

/** Parse a Postgres array literal like {a,"b c"}. Returns undefined if not one. */
function parsePgArray(src) {
    if (!src.startsWith('{') || !src.endsWith('}')) return undefined;
    const body = src.slice(1, -1);
    if (body.trim() === '') return [];
    if (body.includes(':')) return undefined; // looks like a dict, not an array
    const items = [];
    const re = /\s*(?:"((?:[^"\\]|\\.)*)"|([^,]*))\s*(?:,|$)/g;
    let m;
    while ((m = re.exec(body)) !== null && m.index < body.length) {
        items.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2].trim());
    }
    return items;
}

/** Decode a raw column value into a JS value (array / object / primitive). */
export function parseLegacyValue(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== 'string') return raw;
    const text = raw.trim();
    if (text === '') return null;

    try {
        return JSON.parse(text);
    } catch { /* not JSON */ }

    const py = parsePythonLiteral(text);
    if (py !== undefined) return py;

    const pg = parsePgArray(text);
    if (pg !== undefined) return pg;

    return text;
}

/** Always returns an array. A lone scalar string becomes a one-item list. */
export function parseList(raw) {
    const v = parseLegacyValue(raw);
    if (Array.isArray(v)) return v;
    if (v === null || v === undefined || v === '') return [];
    if (typeof v === 'object') return Object.values(v);
    return [v];
}

/** Always returns a plain object. */
export function parseObject(raw) {
    const v = parseLegacyValue(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

/** Coerce 1/0, 't'/'f', 'true'/'false', 'yes'/'no', booleans → boolean. */
export function toBool(raw) {
    if (typeof raw === 'boolean') return raw;
    if (raw === null || raw === undefined) return false;
    return ['1', 't', 'true', 'yes', 'y'].includes(String(raw).trim().toLowerCase());
}

/** Canonical status casing: 'Submitted' → 'submitted', 'Reviewed' stays readable. */
export function normalizeStatus(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (s === 'submitted') return 'submitted';
    if (s === 'draft' || s === '') return 'draft';
    if (s === 'reviewed') return 'Reviewed';
    if (s === 'for revision') return 'For Revision';
    if (s === 'disapproved') return 'Disapproved';
    return raw;
}
