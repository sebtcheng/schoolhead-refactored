const fs = require('fs');
const content = fs.readFileSync('e:/InsightEd-SchoolHead-Official/src/components/modular/Unit2Learners.jsx', 'utf8');
const lines = content.split('\n');

for (let i = 2200; i < 2350; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
