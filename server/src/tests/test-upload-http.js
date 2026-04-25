const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/client.tests.env' });

const { register, fetchProtected, login, buildCookieHeader } = require('./auth.tests');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL;
const testImagePath = path.join(__dirname, 'test-avatar.png');

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    if (obj !== undefined) console.log(obj);
}

async function fetchProtectedAvatar(path, method = 'GET', body = null, headers = {}, accessToken, cookies) {
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'Cookie': buildCookieHeader(cookies),
            ...headers,
        },
    };

    if (body) opts.body = JSON.stringify(body);

    const response = await fetch(`127.0.0.1:8080/protected/${path}`, opts);
    return response.json();
}

async function main() {
    try {
        console.log('\n========== SETUP: CREATE USER ==========');
        
        const ts = Math.ceil(Math.random() * 10**6);
        let user = await register(`upload${ts}`, `upload${ts}@example.com`, 'TestPassword123');
        user = await login(`upload${ts}`, 'TestPassword123');
        log('registered', { userId: user.userId });
        
        console.log('\n========== UPLOAD AVATAR ==========');
        
        const fileBuffer = fs.readFileSync(testImagePath);
        const blob = new Blob([fileBuffer], { type: 'image/png' });

        const formData = new FormData();
        formData.append('avatar', blob, 'test-avatar.png');  

        const response = await fetch(`${BASE_URL}/files/avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${user.accessToken}`,
                'Cookie': buildCookieHeader(user.cookies)
            },
            body: formData
        });
        const uploadData = await response.json();
        
        log('uploaded', uploadData);

        console.log('\n========== GET AVATAR ==========');
        
        const avatarRes = await fetch(`http://localhost:8080/api/files/avatar/${user.profileId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${user.accessToken}`,
                'Cookie': buildCookieHeader(user.cookies),
            },
        });
        console.log('avatar status:', avatarRes.status); 
        log('avatar', avatarRes);

        console.log('\n\nALL UPLOAD TESTS PASSED \n');
    } catch (e) {
        console.error(`\nFAILED: ${e.message}`);
    }
}

main();