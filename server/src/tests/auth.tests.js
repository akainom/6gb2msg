const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/client.tests.env' });

const BASE_URL = process.env.BASE_URL;
const WS_URL = process.env.WS_URL;

function parseCookies(response) {
    const cookies = {};
    const setCookie = response.headers.getSetCookie?.() ?? [];
    setCookie.forEach(cookie => {
        const [pair] = cookie.split(';');
        const [key, value] = pair.split('=');
        cookies[key.trim()] = value?.trim();
    });
    return cookies;
}

function buildCookieHeader(cookies) {
    return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
}

async function login(username, password) {
    const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });

    const body = await response.json();

    if (response.status !== 200) {
        return { failed: true, ...body };
    }

    const cookies = parseCookies(response);
    const accessToken = body.data.accessToken;
    const userId = body.data.user_id;
    const profileId = body.data._id;

    return { accessToken, userId, profileId, cookies };
}

async function register(username, email, password) {
    const response = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
    });

    const body = await response.json();

    if (response.status !== 200 && response.status !== 201) {
        return { failed: true, ...body };
    }

    const cookies = parseCookies(response);
    const accessToken = body.data.accessToken;
    const userId = body.data.user_id;

    return { accessToken, userId, cookies };
}

async function fetchProtected(path, method = 'GET', body = null, headers = {}, accessToken, cookies) {
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

    const response = await fetch(`${BASE_URL}${path}`, opts);
    return response.json();
}

module.exports = { login, register, fetchProtected, parseCookies, buildCookieHeader };