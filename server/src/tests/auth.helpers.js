function parseCookies(response) {
    const cookies = {};
    const setCookie = response.headers?.getSetCookie?.() ?? [];
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

function previewText(content, max = 120) {
    if (!content) return '';
    const t = String(content).trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
}

module.exports = { parseCookies, buildCookieHeader, previewText };