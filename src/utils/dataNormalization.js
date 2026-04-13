export const normalizeOffering = (val) => {
    if (!val) return '';
    const lower = String(val).toLowerCase().trim();

    if (lower.includes('purely es') || lower.includes('purely elementary')) return 'Purely Elementary'; 
    if (lower.includes('es and jhs') || lower.includes('k to 10') || lower.includes('k-10')) return 'Elementary School and Junior High School (K-10)';
    if (lower.includes('all offering') || lower.includes('k to 12') || lower.includes('k-12')) return 'All Offering (K to 12)';
    if (lower.includes('jhs with shs') || lower.includes('junior high and senior high') || lower.includes('junior and senior high')) return 'Junior High and Senior High';
    if (lower.includes('purely jhs') || lower.includes('purely junior high')) return 'Purely Junior High School';
    if (lower.includes('purely shs') || lower.includes('purely senior high')) return 'Purely Senior High School';
    if (lower.includes('es with shs')) return 'Elementary School and Senior High School';

    return val; // Return original if no match
};

export const toProperCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};
