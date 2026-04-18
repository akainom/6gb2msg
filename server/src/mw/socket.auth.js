const TokenService = require('../services/token.service');

/**
 * @description verifies JWT access token on WS handshake.
 * token is passed via socket.handshake.auth.token
 * or Authorization: Bearer header as fallback.
 *
 * On success — populates socket.data.userId
 * On failure — calls next() with an error which Socket.io converts to a connect_error event
 */
async function authMiddleware(socket, next) {
    try {
        let token = socket.handshake.auth?.token;

        if (!token) {
            const authHeader = socket.handshake.headers?.authorization;
            if (authHeader?.startsWith('Bearer ')) {
                token = authHeader.slice(7);
            }
        }

        if (!token) {
            return next(new Error('ERR_NO_TOKEN'));
        }

        const decoded = TokenService.verifyAccessToken(token);
        if (!decoded?.userid) {
            return next(new Error('ERR_TOKEN_INVALID'));
        }

        socket.data.userId = String(decoded.userid);

        return next();
    } catch (e) {
        return next(new Error(e.code ?? 'ERR_AUTH_FAILED'));
    }
}

module.exports = authMiddleware;