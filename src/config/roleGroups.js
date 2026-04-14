export const ROLE_GROUPS = {
    EDUCATIONAL_ADMIN: 'HROD', // Exclusive to Super User 2.0 (National HROD Portal)
    TECHNICAL_FINANCE: 'Infrastructure', // Exclusive to Super User 2.0 (National Project Summary)
    MANAGEMENT: 'Management', // RO, SDO, CO, Admin, HR
    INFRA_OPERATIONAL: 'Infra_Operational', // Engineers, Agencies, Finance, LGU
    SCHOOL: 'School' // School-level personnel
};

export const ROLE_GROUP_MAP = {
    // HROD (Group 1 - Super User 2.0 Exclusive)
    'Super User': ROLE_GROUPS.EDUCATIONAL_ADMIN,
    'Super Admin': ROLE_GROUPS.EDUCATIONAL_ADMIN,

    // Infrastructure National (Group 2 - Super User 2.0 Exclusive)
    // Both groups are accessible to Super Users but represent different domain portals
    // 'Super User': also mapped above

    // Management (Group 4 - Operational Monitoring)
    'Regional Office': ROLE_GROUPS.MANAGEMENT,
    'School Division Office': ROLE_GROUPS.MANAGEMENT,
    'Central Office': ROLE_GROUPS.MANAGEMENT,
    'Admin': ROLE_GROUPS.MANAGEMENT,
    'Human Resource': ROLE_GROUPS.MANAGEMENT,

    // Infra Operations (Group 5 - Interactive Tools)
    'Engineer': ROLE_GROUPS.INFRA_OPERATIONAL,
    'DepEd Engineer': ROLE_GROUPS.INFRA_OPERATIONAL,
    'Division Engineer': ROLE_GROUPS.INFRA_OPERATIONAL,
    'Non-DepEd Engineer': ROLE_GROUPS.INFRA_OPERATIONAL,
    'EFD Engineer': ROLE_GROUPS.INFRA_OPERATIONAL,
    'Implementing Agency': ROLE_GROUPS.INFRA_OPERATIONAL,
    'Local Government Unit': ROLE_GROUPS.INFRA_OPERATIONAL,
    'Central Office Finance': ROLE_GROUPS.INFRA_OPERATIONAL,
    'Finance': ROLE_GROUPS.INFRA_OPERATIONAL,

    // School (Group 3 - Specific School Data)
    'School Head': ROLE_GROUPS.SCHOOL,
    'school_head': ROLE_GROUPS.SCHOOL,
    
    // Normalized roles
    'deped_engineer': ROLE_GROUPS.INFRA_OPERATIONAL,
    'hrodi_engineer': ROLE_GROUPS.INFRA_OPERATIONAL,
    'efd': ROLE_GROUPS.INFRA_OPERATIONAL,
    'hrodi': ROLE_GROUPS.INFRA_OPERATIONAL,
    'lgu': ROLE_GROUPS.INFRA_OPERATIONAL,
    'PGO': ROLE_GROUPS.INFRA_OPERATIONAL,
    'CGO': ROLE_GROUPS.INFRA_OPERATIONAL,
    'MGO': ROLE_GROUPS.INFRA_OPERATIONAL,
    'DPWH': ROLE_GROUPS.INFRA_OPERATIONAL,
    'CSO': ROLE_GROUPS.INFRA_OPERATIONAL,
    
    // New roles
    'Architect': ROLE_GROUPS.INFRA_OPERATIONAL,
    'Regional Engineer': ROLE_GROUPS.MANAGEMENT
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



