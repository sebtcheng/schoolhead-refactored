import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { upsertBinary } from '../api/utils/binaryPipeline.js';

// Load environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const PHOTOS_DIR = path.join(ROOT_DIR, 'insighted_engr_photos');
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
    console.error("❌ DATABASE_URL missing from .env");
    process.exit(1);
}

const { Pool } = pg;
const isLocal = DB_URL.includes('localhost') || DB_URL.includes('127.0.0.1') || DB_URL.includes('20.24.58.49');
const pool = new Pool({
    connectionString: DB_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false }
});

async function run() {
    console.log("🚀 Starting Engineer Photo Import...");
    
    if (!fs.existsSync(PHOTOS_DIR)) {
        console.error(`❌ Dir not found: ${PHOTOS_DIR}`);
        return;
    }

    const files = fs.readdirSync(PHOTOS_DIR).filter(f => !f.startsWith('.'));
    console.log(`Total files to process: ${files.length}`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const file of files) {
        try {
            // Pattern: [IPC]_[PROJECT_ID]_[IMAGE_ID].ext
            // Example: INF-01-2024-00163_1009830_1603.webp
            const match = file.match(/^(.+)_(\d+)_/);
            if (!match) {
                console.warn(`⚠️ skipping malformed filename: ${file}`);
                skipCount++;
                continue;
            }

            const ipc = match[1];
            const projectIdStr = match[2];
            const projectId = parseInt(projectIdStr, 10);

            // 1. Verify project exists
            const projRes = await pool.query(
                'SELECT project_id, ipc FROM engineer_form WHERE project_id = $1 OR ipc = $2 LIMIT 1',
                [projectId, ipc]
            );

            if (projRes.rows.length === 0) {
                console.warn(`⚠️ Project not found for ${file} (ID: ${projectId}, IPC: ${ipc})`);
                skipCount++;
                continue;
            }

            const actualProjectId = projRes.rows[0].project_id;
            const actualIpc = projRes.rows[0].ipc;

            // 2. Read file and upsert binary
            const filePath = path.join(PHOTOS_DIR, file);
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(file).toLowerCase();
            let mimeType = 'image/webp'; // default for these photos
            if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
            if (ext === '.png') mimeType = 'image/png';
            if (ext === '.bin') mimeType = 'application/octet-stream';

            const { binary_id, stored_size } = await upsertBinary(pool, buffer, mimeType);

            // 3. Check if already linked in engineer_image
            const existingLink = await pool.query(
                'SELECT id FROM engineer_image WHERE project_id = $1 AND binary_id = $2',
                [actualProjectId, binary_id]
            );

            if (existingLink.rows.length > 0) {
                // console.log(`⏭️ Already linked: ${file}`);
                skipCount++;
                continue;
            }

            // 4. Create link
            await pool.query(
                `INSERT INTO engineer_image (project_id, binary_id, image_data, ipc, file_size, category, uploaded_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [actualProjectId, binary_id, `/api/asset/${binary_id}`, actualIpc, stored_size, 'Internal', 'SYSTEM_IMPORT']
            );

            console.log(`✅ Imported: ${file} -> Project ${actualProjectId}`);
            successCount++;

        } catch (err) {
            console.error(`❌ Error processing ${file}:`, err.message);
            errorCount++;
        }
    }

    console.log("\n--- Import Summary ---");
    console.log(`Success: ${successCount}`);
    console.log(`Skipped: ${skipCount}`);
    console.log(`Errors:  ${errorCount}`);
    
    await pool.end();
}

run().catch(console.error);
