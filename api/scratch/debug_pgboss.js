import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PgBoss = require('pg-boss');

console.log('--- PgBoss Structure ---');
console.log('Type:', typeof PgBoss);
console.log('Keys:', Object.keys(PgBoss));
if (PgBoss.default) {
    console.log('Has .default, Type:', typeof PgBoss.default);
}
console.log('------------------------');
