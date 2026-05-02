
import fetch from 'node-fetch';

async function checkApi() {
    const schoolId = '999009'; // From screenshot
    try {
        const res = await fetch(`http://localhost:3000/api/ph_schools/progress/${schoolId}`);
        const json = await res.json();
        console.log('API Response:', JSON.stringify(json, null, 2));
    } catch (err) {
        console.error('Fetch failed:', err.message);
    }
}

checkApi();
