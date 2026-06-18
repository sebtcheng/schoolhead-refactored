import pg from 'pg';
const { Client } = pg;
const client = new Client({
  connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:5432/insightEd',
  ssl: { rejectUnauthorized: false }
});
async function main() {
  console.log("Connecting to port 5432...");
  await client.connect();
  console.log("Success on 5432!");
  await client.end();
}
main().catch(err => {
  console.error("Failed on 5432:", err.message);
});
