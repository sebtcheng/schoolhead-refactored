export const ROLE_GROUPS = {
    MANAGEMENT: 'Management', // Admin, SDO
    SCHOOL: 'School' // School-level personnel
};

export const NEXUS_AUTHORIZED_EMAILS = [
    'admin_co@deped.gov.ph',
    // placeholder1@deped.gov.ph
    // placeholder2@deped.gov.ph
    // placeholder3@deped.gov.ph
    // placeholder4@deped.gov.ph
];

export const ROLE_GROUP_MAP = {
    'Admin': ROLE_GROUPS.MANAGEMENT,
    'School Head': ROLE_GROUPS.SCHOOL,
    'school_head': ROLE_GROUPS.SCHOOL,
    'Super User': ROLE_GROUPS.MANAGEMENT,
    'Super Admin': ROLE_GROUPS.MANAGEMENT,
    'School Division Office': ROLE_GROUPS.MANAGEMENT,
};

export const normalizeRole = (role) => {
    if (!role) return null;
    return role
        .split(/[_\s]+/)
        .map(word => {
            if (word.toLowerCase() === 'deped') return 'DepEd';
            if (word.toLowerCase() === 'efd') return 'EFD';
            if (word.toLowerCase() === 'hrodi') return 'HRODI';
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
};

export const getRoleGroup = (role) => {
    if (!role) return null;
    const normalized = normalizeRole(role);
    return ROLE_GROUP_MAP[normalized] || ROLE_GROUP_MAP[role] || null;
};



