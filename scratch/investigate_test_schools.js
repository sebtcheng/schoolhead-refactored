import pkg from 'pg';
const { Client } = pkg;

async function checkTestSchools() {
    const client = new Client({
        connectionString: "postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd",
        ssl: false // Assuming no SSL needed for this connection based on standard usage here
    });

    try {
        await client.connect();

        console.log("--- Test Schools in schools_IERN ---");
        const iernRes = await client.query("SELECT \"SchoolID\", \"School_Name\" FROM \"schools_IERN\" WHERE \"SchoolID\"::text LIKE '999%' ORDER BY \"SchoolID\"");
        console.log(`Total in schools_IERN: ${iernRes.rows.length}`);

        console.log("\n--- Test Schools in ph_schools ---");
        const phRes = await client.query("SELECT \"school_id\", \"established_month\", \"established_year\", \"head_first_name\", \"head_middle_name\", \"head_last_name\", \"head_sex\", \"head_position_title\", \"head_date_of_birth\" FROM \"ph_schools\" WHERE \"school_id\"::text LIKE '999%' ORDER BY \"school_id\"");
        console.log(`Total in ph_schools: ${phRes.rows.length}`);

        const phSchoolIds = new Set(phRes.rows.map(r => r.school_id.toString()));
        const missingInPh = iernRes.rows.filter(r => !phSchoolIds.has(r.SchoolID.toString()));

        console.log(`\nSchools in IERN but NOT in ph_schools (Available to register): ${missingInPh.length}`);
        if (missingInPh.length > 0) {
            console.log("First 10 missing:");
            console.log(missingInPh.slice(0, 10).map(r => r.SchoolID).join(", "));
        }

        console.log("\n--- Schools in ph_schools with BLANK/NULL columns (Candidates for deletion) ---");
        const blankSchools = phRes.rows.filter(r => {
            // Check if any of these are NULL or empty string
            const cols = [
                'head_first_name', 'head_middle_name', 'head_last_name', 
                'head_sex', 'head_position_title', 'head_date_of_birth'
            ];
            // The screenshot shows established_month and year might be present but the others NULL.
            // User said "delete those where the columns in ph_schools in the screenshot are blank"
            // Usually this means the registration was incomplete or failed halfway.
            return cols.every(col => r[col] === null || r[col] === '');
        });

        console.log(`Total blank test schools in ph_schools: ${blankSchools.length}`);
        if (blankSchools.length > 0) {
            console.log("First 10 blank schools:");
            console.log(blankSchools.slice(0, 10).map(r => r.school_id).join(", "));
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

checkTestSchools();
