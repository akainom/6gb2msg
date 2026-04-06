const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/server.test.env' });

const BASE_URL = 'http://localhost:3000';

function extractCookie(headers, name) {
    const setCookie = headers.getSetCookie?.() ?? [];
    const found = setCookie.find(c => c.startsWith(`${name}=`));
    return found ? found.split(';')[0] : null; 
}

async function post(path, body, headers = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    return { status: res.status, data, headers: res.headers };
}

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    console.log(JSON.stringify(obj, null, 2));
}

const TEST_USER = {
    email: 'controller_test@example.com',
    password: 'TestPassword123',
    username: 'ctrl_test_user',
};

let refreshCookie = null;
let userId = null;
let profileId = null;
let accessToken = null;

async function testRegister() {
    console.log('\n\n========== REGISTER ==========');

    // success
    const res = await post('/auth/register', TEST_USER);
    log('register response', res.data);

    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    if (!res.data.data.accessToken) throw new Error('No accessToken in body');

    refreshCookie = extractCookie(res.headers, 'refreshToken');
    if (!refreshCookie) throw new Error('No refreshToken cookie set');
    console.log(`refreshToken cookie: ${refreshCookie}`);

    userId = res.data.data.user_id;
    profileId = res.data.data.profile._id;
    accessToken = res.data.data.accessToken;

    // duplicate email
    const dupEmail = await post('/auth/register', {
        ...TEST_USER,
        username: 'other_username',
    });
    if (dupEmail.data.code !== 'ERR_EMAIL_EX') throw new Error(`Expected ERR_EMAIL_EX, got ${dupEmail.data.code}`);

    const dupUsername = await post('/auth/register', {
        ...TEST_USER,
        email: 'other@example.com',
    });
    if (dupUsername.data.code !== 'ERR_UNAME_EX') throw new Error(`Expected ERR_UNAME_EX, got ${dupUsername.data.code}`);
    const missing = await post('/auth/register', { email: 'only@email.com' });
    log('missing fields', missing.data);
    if (missing.status !== 400) throw new Error(`Expected 400, got ${missing.status}`);

    console.log('register OK');
}

async function testLogin() {
    console.log('\n\n========== LOGIN ==========');

    // success
    const res = await post('/auth/login', {
        username: TEST_USER.username,
        password: TEST_USER.password,
    });
    log('login response', res.data);

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.data.accessToken) throw new Error('No accessToken');
    if (res.data.data.refreshToken) throw new Error('refreshToken must NOT be in body');

    refreshCookie = extractCookie(res.headers, 'refreshToken');
    if (!refreshCookie) throw new Error('No refreshToken cookie');
    userId = res.data.data.user_id ?? userId;
    accessToken = res.data.data.accessToken;

    const wrong = await post('/auth/login', {
        username: TEST_USER.username,
        password: 'wrongpassword',
    });
    log('wrong password', wrong.data);
    if (wrong.status !== 400) throw new Error(`Expected 400, got ${wrong.status}`);

    // user not found
    const nf = await post('/auth/login', {
        username: 'nobody_xyz',
        password: '12345678',
    });
    log('user not found', nf.data);
    if (nf.status !== 404) throw new Error(`Expected 404, got ${nf.status}`);
    if (nf.data.code !== 'ERR_USR_NF') throw new Error(`Expected ERR_USR_NF, got ${nf.data.code}`);

    console.log('login OK');
}

async function testRefresh() {
    console.log('\n\n========== REFRESH ==========');

    const res = await post('/auth/refresh', {}, {
        'Cookie': refreshCookie,
        'x-user-id': userId,
    });
    log('refresh response', res.data);

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.data.data.accessToken) throw new Error('No new accessToken');

    // update cookie — token was rotated
    const newCookie = extractCookie(res.headers, 'refreshToken');
    if (newCookie) refreshCookie = newCookie;
    accessToken = res.data.data.accessToken;

    // no cookie
    const noCookie = await post('/auth/refresh', {}, { 'x-user-id': userId });
    log('no cookie', noCookie.data);
    if (noCookie.status !== 400) throw new Error(`Expected 400, got ${noCookie.status}`);

    console.log('refresh OK');
}

async function testLogout() {
    console.log('\n\n========== LOGOUT ==========');

    const res = await post('/auth/logout', {}, {
        'Cookie': refreshCookie,
        'x-user-id': userId,
    });
    log('logout response', res.data);

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    // no credentials
    const noCreds = await post('/auth/logout', {});
    log('no credentials', noCreds.data);
    if (noCreds.status !== 400) throw new Error(`Expected 400, got ${noCreds.status}`);

    console.log('logout OK');
}

async function cleanup() {
    console.log('\n\n========== CLEANUP ==========');
    if (!profileId) return;

    const { ProfileRepo } = require('../repos/profile.repo');
    const mongoose = require('mongoose');
    const connectDB = require('../db/connect');

    await connectDB();
    await ProfileRepo.deleteProfileWithUser(profileId);
    console.log(`deleted profile ${profileId}`);
    await mongoose.disconnect();
}

(async () => {
    try {
        await testRegister();
        await testLogin();
        await testRefresh();
        await testLogout();
        console.log('\n\nALL TESTS PASSED \n');
    } catch (e) {
        console.error(`\nFAILED: ${e.message}`);
    } finally {
        await cleanup();
    }
})();