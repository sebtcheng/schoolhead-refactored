const BASE_URL = 'http://127.0.0.1:3000/api';

async function testLocations() {
    try {
        console.log('Testing /api/locations/regions...');
        const regionsRes = await fetch(`${BASE_URL}/locations/regions`);
        if (!regionsRes.ok) {
            console.error('Error fetching regions:', await regionsRes.text());
            return;
        }
        const regions = await regionsRes.json();
        console.log('Regions:', regions.slice(0, 5), '...');

        if (regions.length === 0) return;
        const firstRegion = regions.find(r => r !== 'BLANK REGION') || regions[0];

        // 1. Provinces
        console.log(`\nTesting /api/locations/provinces for ${firstRegion}...`);
        const provincesRes = await fetch(`${BASE_URL}/locations/provinces?region=${encodeURIComponent(firstRegion)}`);
        const provinces = await provincesRes.json();
        console.log('Provinces:', provinces.slice(0, 5), '...');

        // 2. Divisions
        console.log(`\nTesting /api/locations/divisions for ${firstRegion}...`);
        const divisionsRes = await fetch(`${BASE_URL}/locations/divisions?region=${encodeURIComponent(firstRegion)}`);
        const divisions = await divisionsRes.json();
        console.log('Divisions:', divisions.slice(0, 5), '...');

        // 3. Municipalities
        if (provinces.length > 0) {
            const firstProvince = provinces.find(p => p !== 'BLANK PROVINCE') || provinces[0];
            console.log(`\nTesting /api/locations/municipalities-by-province for ${firstRegion} / ${firstProvince}...`);
            const munRes = await fetch(`${BASE_URL}/locations/municipalities-by-province?region=${encodeURIComponent(firstRegion)}&province=${encodeURIComponent(firstProvince)}`);
            const municipalities = await munRes.json();
            console.log('Municipalities:', municipalities.slice(0, 5), '...');

            // 4. Barangays
            if (municipalities.length > 0) {
                const firstMunicipality = municipalities.find(m => m !== 'BLANK MUNICIPALITY') || municipalities[0];
                console.log(`\nTesting /api/locations/barangays for ${firstRegion} / ${firstProvince} / ${firstMunicipality}...`);
                const barRes = await fetch(`${BASE_URL}/locations/barangays?region=${encodeURIComponent(firstRegion)}&province=${encodeURIComponent(firstProvince)}&municipality=${encodeURIComponent(firstMunicipality)}`);
                const barangays = await barRes.json();
                console.log('Barangays:', barangays.slice(0, 5), '...');
            }
        }

        // 5. Districts
        if (divisions.length > 0) {
            const firstDivision = divisions.find(d => d !== 'BLANK DIVISION') || divisions[0];
            console.log(`\nTesting /api/locations/districts for ${firstRegion} / ${firstDivision}...`);
            const distRes = await fetch(`${BASE_URL}/locations/districts?region=${encodeURIComponent(firstRegion)}&division=${encodeURIComponent(firstDivision)}`);
            const districts = await distRes.json();
            console.log('Districts:', districts.slice(0, 5), '...');
        }

        console.log('\nVerification complete.');
    } catch (err) {
        console.error('Verification failed:', err.message);
    }
}

testLocations();
