const jwt = require('jsonwebtoken');
const UserRepo = require('../repos/user.repo');
const { ApiError } = require('../mw/exception'); 


const REFRESH_EXPIRES_SECONDS = 15 * 24 * 60 * 60;
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

class TokenService {
    /**
     * @description signs a short-lived access token
     * @param {mongoose.ObjectId|string} userid 
     * @param {string|number} [expiresIn='30m'] 
     * @returns {string} JWT access token
     */
    genAccesToken(userid, expiresIn = null) {
        return jwt.sign(
            { userid },
            JWT_ACCESS_SECRET,
            { expiresIn: expiresIn ?? '30m' }
        );
    }

    /**
     * @param {string} accessToken
     * @returns {{ userid: string }} decoded payload
     */
    verifyAccessToken(accessToken) {
        try {
            return jwt.verify(accessToken, JWT_ACCESS_SECRET);
        } catch (e) {
            throw ApiError.Forbidden('access token invalid or expired', 'ERR_JWT_ACC', null);
        }
    }

    /**
     * @description signs a long-lived refresh token
     * @param {mongoose.ObjectId|string} userid 
     * @param {string|number} [expiresIn='15d'] 
     * @returns {string} JWT refresh token
     */
    genRefreshToken(userid, expiresIn = null) {
        return jwt.sign(
            { userid },
            JWT_REFRESH_SECRET,
            { expiresIn: expiresIn ?? '15d' }
        );
    }

    /**
     * @description persists refresh token to the database with expiration date
     * @param {mongoose.ObjectId|string} userid 
     * @param {string} refreshToken 
     * @returns {Promise<void>}
     */
    async saveRefreshToken(userid, refreshToken) {
        await UserRepo.addToken(userid, {
            token: refreshToken,
            expiresAt: new Date(Date.now() + REFRESH_EXPIRES_SECONDS * 1000)
        });
    }

    /**
     * @description verifies refresh token signature and expiration
     * @param {string} refreshToken 
     * @returns {Promise<Object|null>} decoded payload or null if invalid
     */
    async verifyRefreshToken(refreshToken) {
        try {
            return jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        } catch (e) {
            throw ApiError.BadRequest('refresh token verify failed', 'ERR_JWT_VER', refreshToken);
        }
    }

    /**
     * @description checks if the refresh token exists in the user's whitelist
     * @param {mongoose.ObjectId|string} userid 
     * @param {string} refreshToken 
     * @returns {Promise<boolean>} true if token is valid and present in DB
     */
    async validateToken(userid, refreshToken) {
        return await UserRepo.hasToken(userid, refreshToken);
    }

    /**
     * @description revokes a specific refresh token from the database
     * @param {mongoose.ObjectId|string} userid 
     * @param {string} refreshToken 
     * @returns {Promise<void>}
     */
    async removeToken(userid, refreshToken, session = null) {
        await UserRepo.removeToken(userid, refreshToken, session);
    }
}

module.exports = new TokenService();