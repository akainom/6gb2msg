const dotenv = require('dotenv');
dotenv.config({
    path: __dirname + '/server.test.env'
});

const BASE_URL = 'http://127.0.0.1:3000';

const createdUserIds = [];
let cookieHeader = '';

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    if (obj !== undefined) console.log(JSON.stringify(obj, null, 2));
}

function parseCookies(setCookieHeader) {
    if (!setCookieHeader || setCookieHeader === 'null') return '';
    const parts = setCookieHeader.split(/,(?=[^;]+=)/g);
    const cookies = parts.map(p => p.split(';')[0].trim());
    return cookies.join('; ');
}

async function post(path, body, headers = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json', 
            'Cookie': cookieHeader,
            ...headers 
        },
        body: JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
        cookieHeader = parseCookies(setCookie);
    }
    return res.json();
}

async function get(path, headers = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'GET',
        headers: { 
            'Content-Type': 'application/json', 
            'Cookie': cookieHeader,
            ...headers 
        },
    });
    return res.json();
}

async function postNoBody(path, headers = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 
            'Cookie': cookieHeader,
            ...headers 
        },
    });
    return res.json();
}

async function runTests() {
    let accessToken1, userId1;

    try {
        console.log('\n========== REGISTER USER ==========');
        const register = await post('/auth/register', {
            email: 'testauth' + Date.now() + '@example.com',
            password: 'TestPassword123!',
            username: 'testuser' + Math.ceil(Math.random() * 10**4)
        });
        log('register', register);

        if (register.status !== 'ok') {
            throw new Error('Registration failed: ' + JSON.stringify(register));
        }

        accessToken1 = register.data.accessToken;
        userId1 = register.data.user_id;
        createdUserIds.push(userId1);

        console.log('\n========== ACCESS PROTECTED ROUTE ==========');
        const chats = await get('/chats', { 'Authorization': `Bearer ${accessToken1}` });
        log('chats with token', chats);

        console.log('\n========== UNAUTHORIZED REQUEST ==========');
        const unauthorized = await get('/chats');
        log('no token', unauthorized);

        console.log('\n========== INVALID TOKEN ==========');
        const invalid = await get('/chats', { 'Authorization': 'Bearer invalidtoken123' });
        log('invalid token', invalid);

        console.log('\n========== WRONG FPRINT ==========');
        const wrongFprint = await get('/chats', { 
            'Authorization': `Bearer ${accessToken1}`,
            'Cookie': 'fprint=wrongfprint'
        });
        log('wrong fprint', wrongFprint);

        console.log('\n========== REFRESH TOKEN ==========');
        const refresh = await post('/auth/refresh', {}, { 'x-user-id': userId1 });
        log('refresh', refresh);
        
        if (refresh.status !== 'ok' || !refresh.data?.accessToken) {
            throw new Error('Refresh failed: ' + JSON.stringify(refresh));
        }
        
        const newAccessToken = refresh.data.accessToken;

        console.log('\n========== ACCESS WITH NEW TOKEN ==========');
        const chatsNew = await get('/chats', { 'Authorization': `Bearer ${newAccessToken}` });
        log('chats with new token', chatsNew);

        console.log('\n========== LOGOUT ==========');
        const logout = await postNoBody('/auth/logout', { 'Authorization': `Bearer ${newAccessToken}`, 'x-user-id': userId1 });
        log('logout', logout);

    } catch (e) {
        console.error('Test error:', e.message);
    } finally {
        console.log('\n========== DONE ==========');
    }
};

runTests();