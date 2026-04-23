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
    const targetId = '301718';
    let targetEmail = null;

    console.log(`--- Checking SQL Users ---`);
    let res = await pool.query("SELECT * FROM users WHERE email LIKE $1", [`${targetId}@%`]);
    if (res.rows.length > 0) {
        console.log("Found in users:", res.rows[0]);
        targetEmail = res.rows[0].email;
    } else {
        console.log(`Not found in users table for ${targetId}@%`);
    }

    console.log(`\n--- Checking SQL School Profiles ---`);
    res = await pool.query("SELECT * FROM school_profiles WHERE school_id = $1", [targetId]);
    if (res.rows.length > 0) {
        console.log("Found in school_profiles Email:", res.rows[0].email, "Name:", res.rows[0].school_name, "Submitted By:", res.rows[0].submitted_by);
        if (!targetEmail && res.rows[0].email) {
            targetEmail = res.rows[0].email;
        }
    } else {
        console.log(`Not found in school_profiles for ${targetId}`);
    }

    if (!targetEmail) {
        targetEmail = `${targetId}@deped.gov.ph`;
        console.log(`\nFallback target email: ${targetEmail}`);
    } else {
        console.log(`\nResolved target email: ${targetEmail}`);
    }

    try {
        const fbUser = await admin.auth().getUserByEmail(`${targetId}@insighted.app`);
        targetEmail = fbUser.email;
        console.log(`Firebase target email override mapped to: ${targetEmail}`);
    } catch (err) {
        console.log(`Not mapped to @insighted.app in Firebase (or error):`, err.message);
    }

    console.log(`\n--- Checking Firebase Auth for ${targetEmail} ---`);
    try {
        const fbUser = await admin.auth().getUserByEmail(targetEmail);
        console.log(`Found in Firebase:`, {
            uid: fbUser.uid,
            email: fbUser.email,
            disabled: fbUser.disabled
        });
    } catch (err) {
        console.log(`Error looking up in Firebase Auth:`, err.message);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
