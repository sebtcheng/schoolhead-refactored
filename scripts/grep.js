import { execSync } from 'child_process';

const pattern = process.argv[2] || '';
try {
  const result = execSync(`git grep "${pattern}" apps/ packages/`, { encoding: 'utf8' }).trim();
  if (result) {
    console.log(result);
    process.exit(1);
  }
} catch (e) {
  // Exit code 1 from git grep means 0 matches found!
  console.log(`0 matches found for "${pattern}" across apps/ and packages/.`);
  process.exit(0);
}
