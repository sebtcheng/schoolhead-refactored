/**
 * Submission Helper Utilities
 * 
 * Provides robust error classification for modular unit submissions,
 * distinguishing between true network failures and server-side errors.
 * 
 * This prevents the bug where server errors (HTTP 500, 400, etc.) are
 * incorrectly treated as "offline" scenarios and silently saved to the outbox.
 */

/**
 * Determines if an error is a genuine network connectivity failure
 * (i.e., the request never reached the server), as opposed to a server-side
 * error (where the server responded but with an error status).
 * 
 * ONLY network failures should trigger the outbox fallback, because:
 * - Server errors (500, 400) will just fail again when synced from the outbox
 * - Network errors are transient and likely to succeed on retry
 * 
 * @param {Error} error - The caught error object
 * @returns {boolean} True if this is a genuine network/connectivity error
 */
export function isNetworkError(error) {
    // 1. The browser reports we're offline
    if (!navigator.onLine) return true;

    // 2. TypeError: Failed to fetch — the canonical network-level failure
    //    This is THE error the browser throws when a fetch() request cannot
    //    reach the server at all (DNS failure, CORS preflight blocked,
    //    server unreachable, SSL handshake failure, etc.)
    if (error instanceof TypeError && error.message === 'Failed to fetch') return true;

    // 3. AbortError — request was aborted (e.g., timeout)
    if (error.name === 'AbortError') return true;

    // 4. Explicit network error marker from our own fetch wrappers
    if (error._isNetworkError === true) return true;

    // Everything else is considered a server/application error
    return false;
}

/**
 * Wraps a fetch call with better error classification.
 * 
 * - If the server responds (even with 4xx/5xx), this returns the response.
 * - If the request never reaches the server, this throws an error
 *   marked as a network error via the `_isNetworkError` flag.
 * 
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} The server's response
 * @throws {Error} A network error with `_isNetworkError = true`
 */
export async function resilientFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        return response;
    } catch (err) {
        // At this point, the request never reached the server.
        // Tag it so our catch blocks can identify it.
        const networkErr = new Error(
            `Network error: Could not reach the server. (${err.message})`
        );
        networkErr._isNetworkError = true;
        networkErr.originalError = err;
        throw networkErr;
    }
}

/**
 * Extracts a user-friendly error message from a failed API response.
 * 
 * @param {Response} response - The failed fetch Response object
 * @returns {Promise<string>} A descriptive error message
 */
export async function extractServerError(response) {
    try {
        const data = await response.json();
        return data.details || data.error || data.message || `Server Error ${response.status}`;
    } catch {
        try {
            const text = await response.text();
            return text || `Server Error ${response.status}`;
        } catch {
            return `Server Error ${response.status}`;
        }
    }
}

/**
 * Console-logs a structured diagnostic snapshot for submission debugging.
 * This helps trace exactly what happened when a submission fails.
 * 
 * @param {string} unitLabel - e.g., "Unit 4"
 * @param {string} errorType - "NETWORK" or "SERVER" or "UNKNOWN"
 * @param {Error} error - The caught error
 * @param {object} [context] - Optional context (payload size, schoolId, etc.)
 */
export function logSubmissionDiagnostic(unitLabel, errorType, error, context = {}) {
    const timestamp = new Date().toISOString();
    const diagnostic = {
        timestamp,
        unit: unitLabel,
        errorType,
        message: error.message,
        online: navigator.onLine,
        connectionType: navigator.connection?.effectiveType || 'unknown',
        ...context,
    };

    console.group(`🔴 [${unitLabel}] Submission ${errorType} Error — ${timestamp}`);
    console.error('Error:', error);
    console.table(diagnostic);
    if (error.originalError) {
        console.error('Original Error:', error.originalError);
    }
    console.groupEnd();

    return diagnostic;
}
