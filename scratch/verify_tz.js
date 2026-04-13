
const dateStrUTC = "2026-04-10 18:00:00"; // What TIMESTAMP used to return (naive)
const dateStrTZ = "2026-04-10T18:00:00.000Z"; // What TIMESTAMPTZ will return (ISO)

console.log("--- Naive TIMESTAMP Behavior ---");
const dateNaive = new Date(dateStrUTC);
console.log("Input:", dateStrUTC);
console.log("Local String:", dateNaive.toLocaleDateString());
console.log("Local Time:", dateNaive.toLocaleTimeString());

console.log("\n--- TIMESTAMPTZ Behavior ---");
const dateTZ = new Date(dateStrTZ);
console.log("Input:", dateStrTZ);
console.log("Local String:", dateTZ.toLocaleDateString());
console.log("Local Time:", dateTZ.toLocaleTimeString());

console.log("\nVerification: If the local time is Philippines (UTC+8),");
console.log("TIMESTAMPTZ should show April 11, 2:00 AM.");
