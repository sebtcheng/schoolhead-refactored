import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect().then(async () => {
    try {
        const res = await client.query("UPDATE siif_submissions SET submission_status = 'draft' WHERE school_id = '999163'");
        console.log(`Updated ${res.rowCount} rows. Status reset to 'draft'.`);
    } catch (err) {
        console.error(err);
    } finally {
        client.end();
    }
});
