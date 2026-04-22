import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');

console.log('--- DB DIAGNOSTIC ---');
console.log('__dirname:', __dirname);
console.log('Env Path:', envPath);
console.log('File Exists?', fs.existsSync(envPath));

// Mocking the config load
dotenv.config({ path: envPath });

console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('---------------------');
