/**
 * Verbose Logging Utility
 * Consistent with Master Architect standards
 */

const COLORS = {
    info: '#0038A8',
    warn: '#FCD116',
    error: '#CE1126',
    success: '#10B981',
    debug: '#64748B'
};

const getTimestamp = () => new Date().toLocaleTimeString();

const log = (level, marker, message, ...data) => {
    const color = COLORS[level] || COLORS.debug;
    const prefix = `%c[OS-${marker.toUpperCase()}] [${getTimestamp()}]`;
    const style = `color: white; background: ${color}; padding: 2px 6px; border-radius: 4px; font-weight: bold;`;
    
    if (data.length > 0) {
        console[level === 'success' ? 'log' : level](prefix, style, message, ...data);
    } else {
        console[level === 'success' ? 'log' : level](prefix, style, message);
    }
};

export const logger = {
    info: (marker, message, ...data) => log('info', marker, message, ...data),
    warn: (marker, message, ...data) => log('warn', marker, message, ...data),
    error: (marker, message, ...data) => log('error', marker, message, ...data),
    success: (marker, message, ...data) => log('success', marker, message, ...data),
    debug: (marker, message, ...data) => log('debug', marker, message, ...data),
};

export default logger;
