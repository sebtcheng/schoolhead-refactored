import { sendPasswordResetEmail } from '../packages/shared-io/src/helpers.js';

async function testSend() {
  console.log("📨 Testing sendPasswordResetEmail...");
  try {
    const res = await sendPasswordResetEmail({
      to: 'helpdesk.stride@gmail.com', // sending test to self
      code: '123456',
      identifierName: 'Test School Head'
    });
    console.log("✅ Email send result:", res);
  } catch (err) {
    console.error("❌ Send error:", err);
  } finally {
    process.exit(0);
  }
}

testSend();
