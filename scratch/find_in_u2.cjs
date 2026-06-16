const fs = require('fs');
const content = fs.readFileSync('e:/InsightEd-SchoolHead-Official/src/components/modular/Unit2Learners.jsx', 'utf8');
const lines = content.split('\n');
// Let's print lines 300 to 500
for (let i = 300; i < 500; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
