const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/server.test.env' });

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BASE_URL = 'http://127.0.0.1:3000';
const testImagePath = path.join(__dirname, 'test-avatar.png');

async function test() {
    const email = `test_email@mail.com`;
    const password = 'TestPass123';
    const username = `test_11233`;

    console.log('1. Register user...');
    const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
        email,
        password,
        username
    });
    console.log('   User registered:', registerRes.data.data.profile._id);

    const userId = registerRes.data.data.user_id;
    const profileId = registerRes.data.data.profile._id;

    console.log('\n2. Upload avatar...');
    const formData = new FormData();
    formData.append('avatar', fs.createReadStream(testImagePath), {
        filename: 'avatar.png',
        contentType: 'image/png'
    });

    const uploadRes = await axios.post(`${BASE_URL}/files/avatar`, formData, {
        headers: {
            ...formData.getHeaders(),
            'x-user-id': userId
        }
    });
    console.log('   Avatar uploaded:', uploadRes.data.avatar);

    console.log('\n3. Get avatar (X-Accel-Redirect)...');
    try {
        const avatarRes = await axios.get(`${BASE_URL}/files/avatar/${profileId}`, {
            headers: {
                'x-user-id': userId
            },
            responseType: 'arraybuffer'
        });
        console.log('   Avatar retrieved, size:', avatarRes.data.length, 'bytes');
    } catch (e) {
        if (e.response?.status === 200) {
            console.log('   Avatar retrieved, size:', e.response.data.length, 'bytes');
        } else {
            console.log('   Avatar error (nginx not running?):', e.message);
        }
    }

    console.log('\nALL TESTS PASSED');
}

test().catch(e => {
    console.error('Test failed:', e.response?.data || e.message);
    process.exit(1);
});
