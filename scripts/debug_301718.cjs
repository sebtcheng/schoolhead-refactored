const { Pool } = require('pg');
const admin = require('firebase-admin');
const serviceAccount = require('../api/service-account.json');

const pool = new Pool({
    connectionString: 'postgres://Administrator1:<REDACTED_PGB_PASS>@stride-posgre-prod-01.postgres.database.azure.com:5432/insightEd',
    ssl: { rejectUnauthorized: false }
});

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function main() {
    console.log(`--- Checking Firebase for vNI6tTropDNmsGW2j6ElVYwFJJs1 ---`);
    try {
        const fbUser = await admin.auth().getUser('vNI6tTropDNmsGW2j6ElVYwFJJs1');
        console.log(`Found in Firebase:`, {
            uid: fbUser.uid,
            email: fbUser.email,
            disabled: fbUser.disabled
        });
    } catch (err) {
        console.log(`Error looking up old UID in Firebase Auth:`, err.message);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
