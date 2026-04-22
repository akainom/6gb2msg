const { fetchProtected, parseCookies, login } = require('./auth.tests.js');
const BASE_URL = process.env.BASE_URL;
const fs = require('fs');
const path = require('path');

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    if (obj !== undefined) console.log(JSON.stringify(obj, null, 2));
}

(async () => {
    const sessionPath = path.join(__dirname, 'ws', 'session.json');
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    const password = 'TestPass123';
    const loginResult = await login('user1_540806', 'TestPass123');
    const accessToken = loginResult.accessToken;
    const cookies = loginResult.cookies;
    
    log('delete', await fetchProtected('/profiles/me', 
        'DELETE', 
        { password: password }, 
        {}, 
        accessToken,
        cookies
    ));    
})()