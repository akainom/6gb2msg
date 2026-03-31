const jwt = require('jsonwebtoken');
const UserRepo = require('../repos/user.repo');

const REFRESH_EXPIRES_SECONDS = 15 * 24 * 60 * 60;
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

class TokenService {
    genAccesToken(userid, expiresIn = null) {
        return jwt.sign(
            { userid },
            JWT_ACCESS_SECRET,
            { expiresIn: expiresIn ?? '30m' }
        );
    }

    genRefreshToken(userid, expiresIn = null) {
        return jwt.sign(
            { userid },
            JWT_REFRESH_SECRET,
            { expiresIn: expiresIn ?? '15d' }
        );
    }

    async saveRefreshToken(userid, refreshToken) {
        await UserRepo.addToken(userid, {
            token: refreshToken,
            expiresAt: new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000)
        });
    }

    async verifyRefreshToken(refreshToken) {
        try {
            return jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        } catch (e) {
            return null;
        }
    }

    async validateTokenInDb(userid, refreshToken) {
        return await UserRepo.hasToken(userid, refreshToken);
    }

    async removeToken(userid, refreshToken) {
        await UserRepo.removeToken(userid, refreshToken);
    }
}

module.exports = new TokenService();