const TokenService = require('../services/token.service');
const Encryptor = require('../services/enc.service');

async function authMiddleware(socket, next) {
    try {
        let token = socket.handshake.auth?.token;

        if (!token) {
            const authHeader = socket.handshake.headers?.authorization;
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.slice(7);
            }
        }

        if (!token) return next(new Error('ERR_NO_TOKEN'));

        const decoded = TokenService.verifyAccessToken(token);
        if (!decoded?.userid) return next(new Error('ERR_TOKEN_INVALID'));

        const fprint = socket.handshake.auth?.fprint
            ?? parseCookie(socket.handshake.headers?.cookie, 'fprint');

        if (fprint && decoded.claim) {
            const valid = Encryptor.compareFprint(fprint, decoded.claim);
            if (!valid) return next(new Error('ERR_FPRINT_MISMATCH'));
        }

        socket.data.userId = String(decoded.userid);
        return next();
    } catch (e) {
        return next(new Error(e.code ?? 'ERR_AUTH_FAILED'));
    }
}

function parseCookie(cookieStr, name) {
    if (!cookieStr) return null;
    const found = cookieStr.split(';')
        .map(c => c.trim())
        .find(c => c.startsWith(`${name}=`));
    return found ? found.split('=')[1] : null;
}

module.exports = authMiddleware;