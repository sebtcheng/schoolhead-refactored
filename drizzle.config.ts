import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const dbUrl = process.env.CLOUD_DATABASE_URL ||
  process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('CLOUD_DATABASE_URL (or DATABASE_URL) is not set in .env');
}

const isLoopback = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

export default defineConfig({
  schema: './apps/school-head/api/schema/index.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: dbUrl,
    ssl: isLoopback ? false : { rejectUnauthorized: false },
  },
});
