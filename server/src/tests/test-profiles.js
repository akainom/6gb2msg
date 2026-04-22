const dotenv = require('dotenv');
dotenv.config({
    path: __dirname + '/server.test.env'
});

const BASE_URL = 'http://localhost:3000';

const createdProfileIds = [];
const createdUserIds = [];

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    if (obj !== undefined) console.log(JSON.stringify(obj, null, 2));
}

async function post(path, body, headers = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
    return res.json();
}

async function get(path, headers = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...headers },
    });
    return res.json();
}

async function del(path, body = null, headers = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
}

async function registerUser(email, username, password) {
    const res = await post('/auth/register', { email, username, password });
    const userId = res.data?.user_id;
    const token = res.data?.accessToken;
    if (userId) {
        createdUserIds.push(userId);
    }
    return { userId, token };
}

async function cleanup() {
    console.log('\n========== CLEANUP ==========');
    for (const userId of createdUserIds.reverse()) {
        try {
            await del('/profiles/me', { password: 'TestPassword123' }, { 'x-user-id': userId });
            console.log('Deleted user:', userId);
        } catch (e) {
            console.log('Cleanup error:', e.message);
        }
    }
}

const runTests = async () => {
    let user1, user2, user3;
    let profile1, profile2, profile3;
    let token1, token2, token3;

    try {
        console.log('\n========== REGISTER 3 USERS ==========');
        user1 = await registerUser('testprofile1@example.com', 'testuser1', 'testpass123');
        user2 = await registerUser('testprofile2@example.com', 'testuser2', 'testpass123');
        user3 = await registerUser('testprofile3@example.com', 'testuser3', 'testpass123');
        token1 = user1.token;
        token2 = user2.token;
        token3 = user3.token;

        console.log('\n========== GET PROFILE BY USER ID ==========');
        profile1 = await get(`/profiles/by-user/${user1.userId}`, { 'x-user-id': user1.userId });
        log('user1 profile', profile1);
        profile2 = await get(`/profiles/by-user/${user2.userId}`, { 'x-user-id': user2.userId });
        log('user2 profile', profile2);

        console.log('\n========== GET PROFILE BY ID ==========');
        const p1 = await get(`/profiles/${profile1.data._id}`);
        log('profile by id', p1);

        console.log('\n========== UPDATE OWN PROFILE ==========');
        const updated = await fetch(`${BASE_URL}/profiles/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'x-user-id': user1.userId },
            body: JSON.stringify({ bio: 'Updated bio', status: 'online' }),
        });
        const updatedRes = await updated.json();
        log('updated profile', updatedRes);

        console.log('\n========== SEARCH PROFILES ==========');
        const search1 = await get(`/profiles/search?q=testuser`, { 'x-user-id': user1.userId });
        log('search testuser', search1);

        const search2 = await get(`/profiles/search?q=nonexistentuser123`, { 'x-user-id': user1.userId });
        log('search nonexistent', search2);

        console.log('\n========== DELETE ACCOUNT ==========');
        const deleted = await del('/profiles/me', { password: 'TestPassword123' }, { 'x-user-id': user3.userId });
        log('delete account', deleted);
        createdUserIds.pop();

    } catch (e) {
        console.error('Test error:', e.message);
    } finally {
        await cleanup();
        console.log('\n========== DONE ==========');
    }
};

runTests();