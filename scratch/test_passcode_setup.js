
import jwt from 'jsonwebtoken';

async function testPasscodeSetup() {
    const secret = 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
    // Use a known UID from previous cleanup or research (e.g. 999000)
    const token = jwt.sign({ uid: '999000' }, secret);

    try {
        const response = await fetch('http://[::1]:3000/api/auth/setup-passcode', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ passcode: '123456' })
        });
        const text = await response.text();
        console.log("Response Status:", response.status);
        console.log("Response Text:", text);
        if (text) {
            const data = JSON.parse(text);
            console.log("Test Passcode Setup (999000):", data);
        }
    } catch (err) {
        console.error("Test failed:", err.message);
    }
}

testPasscodeSetup();
