
async function testCheckSchool() {
    try {
        const response = await fetch('http://127.0.0.1:3000/api/check-existing-school', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolId: '999000' })
        });
        const data = await response.json();
        console.log("Test Check-School (999000 - should exist):", data);

        const response2 = await fetch('http://127.0.0.1:3000/api/check-existing-school', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolId: '999001' })
        });
        const data2 = await response2.json();
        console.log("Test Check-School (999001 - should not exist):", data2);
    } catch (err) {
        console.error("Test failed:", err.message);
    }
}

testCheckSchool();
