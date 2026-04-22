const http = require('http');
const jwt = require('jsonwebtoken');

async function debugCall() {
  const uid = 'c4316fa2-6141-4569-a1b4-8629060cafee'; // David's UID
  const email = 'david.pacheco@deped.gov.ph';
  const role = 'Division Engineer';
  const region = 'REGION XII';
  const division = 'SARANGANI';

  const secret = process.env.JWT_SECRET || 'STRIDE_INSIGHTED_SECRET_2026_KEY_PROD';
  const testToken = jwt.sign({ uid, email, role, region, division }, secret, { expiresIn: '30d' });

  console.log("Using Test Token:", testToken);

  const options = {
    hostname: '127.0.0.1',
    port: 3000,
    path: `/api/projects?engineer_id=${uid}&limit=all`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${testToken}`
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (res.statusCode === 200) {
          console.log("Success! Data count:", json.data ? json.data.length : "N/A");
          if (json.data && json.data.length > 0) {
            console.log("Sample project:", JSON.stringify(json.data[0], null, 2));
          }
        } else {
          console.log("Response Body:", JSON.stringify(json, null, 2));
        }
      } catch (e) {
        console.log("Response is not JSON:", data.slice(0, 200));
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.end();
}

debugCall();
