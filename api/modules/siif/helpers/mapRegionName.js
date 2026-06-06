// ─── Region Name Mapper ───────────────────────────────────────────────────────
// Pure function — no DB, no I/O. Maps plain region names to standardized codes.

export function mapRegionName(region) {
    if (!region) return region;
    const upper = region.toUpperCase();
    const mapping = {
        'MIMAROPA': 'Region IV-B',
        'CALABARZON': 'Region IV-A',
        'NATIONAL CAPITAL REGION': 'NCR',
        'CORDILLERA ADMINISTRATIVE REGION': 'CAR',
        'DAVAO REGION': 'Region XI',
        'SOCCSKSARGEN': 'Region XII',
        'BICOL REGION': 'Region V',
        'WESTERN VISAYAS': 'Region VI',
        'CENTRAL VISAYAS': 'Region VII',
        'EASTERN VISAYAS': 'Region VIII',
        'ZAMBOANGA PENINSULA': 'Region IX',
        'NORTHERN MINDANAO': 'Region X',
        'CARAGA': 'Region XIII',
    };
    return mapping[upper] || region;
}
