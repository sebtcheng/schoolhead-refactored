import { poolUsers } from '../packages/shared-db/src/db.js';
import { saveOtp } from '../packages/shared-auth/src/passwordReset.js';

async function test() {
  try {
    console.log("Testing saveOtp with number ttlMinutes...");
    await saveOtp(poolUsers, 'test.schoolhead.query@deped.gov.ph', '112233', 10);
    console.log("✅ saveOtp succeeded!");
  } catch (err) {
    console.error("❌ saveOtp failed with error:", err.message, err.stack);
  } finally {
    await poolUsers.end();
    process.exit(0);
  }
}

test();
