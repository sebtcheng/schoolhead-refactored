import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.DATABASE_URL || 'postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd';
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('20.24.58.49');

console.log("DEBUG_ENV_START");
console.log(`DATABASE_URL: ${dbUrl}`);
console.log(`isLocal: ${isLocal}`);
console.log(`SSL_SETTING: ${isLocal ? 'false' : 'true (rejectUnauthorized: false)'}`);
console.log("DEBUG_ENV_END");
