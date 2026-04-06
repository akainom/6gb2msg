const mongoose = require('mongoose');
const User = require('../models/user');
const Base = require('./base.repo');

class userDTO {
    constructor(email, password, authProvider, role) {
        this.email = email;
        this.password = password;
        this.authProvider = authProvider;
        this.role = role;

        this.createdAt = new Date();
    }
}

class UserRepo extends Base {
    constructor() {
        super(User);
    }

    /**
     * @description pulls 'refreshTokens' field for specified user
     * @param {mongoose.ObjectId} userid 
     * @returns {Promise<Array>} array of refresh token objects
     */
    async getFreshToken(userid) {
        const bufferTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        const user = await this.model.findOne({
            _id: userid,
            refreshTokens: { 
                $elemMatch: { expiresAt: { $gt: bufferTime } } 
            }
        }).select('refreshTokens').lean();

        if (!user || !user.refreshTokens.length) return null;

        const fresh = user.refreshTokens.find(t => t.expiresAt > bufferTime);
        return fresh ? fresh.token : null;
    }

    /**
     * @description checks if specified refreshToken belongs to user
     * @param {mongoose.ObjectId} userid 
     * @param {string} refreshToken 
     * @returns {Promise<boolean>} true if token exists, false otherwise
     */
    async hasToken(userid, refreshToken) {
        const user = await this.model.findOne({
            _id: userid,
            refreshTokens: { $elemMatch: { token: refreshToken } }
        });

        return !!user;
    }

    /**
     * @description pushes new token to user's tokens if it doesn't already exist
     * @param {mongoose.ObjectId} userid 
     * @param {Object} tokenData
     * @param {string} tokenData.token
     * @param {Date} tokenData.expiresAt
     * @param {mongoose.ClientSession} [session=null] 
     * @returns {Promise<Object|null>} updated user document
     */
    async addToken(userid, tokenData, session = null) {
        return await this.model.findOneAndUpdate(
            { 
                _id: userid, 
                'refreshTokens.token': { $ne: tokenData.token } 
            },
            { 
                $push: { 
                    refreshTokens: { 
                        token: tokenData.token, 
                        expiresAt: tokenData.expiresAt 
                    } 
                } 
            },
            { session, new: true }
        ).lean();
    }

    /**
     * @description removes specified refresh token from user's tokens
     * @param {mongoose.ObjectId} userid 
     * @param {string} refreshToken 
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Object|null>} updated user document    
     */
    async removeToken(userid, refreshToken, session = null) {
        return await this.model.findByIdAndUpdate(
            userid, 
            { $pull: { refreshTokens: { token: refreshToken } } },
            { session, new: true }
        ).lean();
    }

    /**
     * @description clears all refresh tokens for the specified user
     * @param {mongoose.ObjectId} userid 
     * @param {mongoose.ClientSession} session
     * @returns {Promise<Object|null>} updated user document
     */
    async removeAllTokens(userid, session = null) {
        return await this.model.findByIdAndUpdate(
            userid,
            { $set: { refreshTokens: [] } },
            { session, new: true }
        ).lean();
    }

    /**
     * 
     * @param {string} email 
     * @returns {Promise<Boolean>} true if exists, false otherwise
     */
    async emailExists(email) {
        const emailExists = await this.model.exists({ email });

        return emailExists ? true : false;
    }

    async getUserId(email) {
        const userid = await this.model.findOne({ email }).select('_id').lean();

        return userid ? userid : null;
    }

    async getBySSO(ssoId) {
        const user = await this.model.findOne({ ssoId }).lean();

        return user ? user : null;
    }

    async getByEmailHash(email) {
        const user = await this.model.findOne({ emailHash: email }).lean();

        return user ? user : null;
    }

    async getAuthData(userid) {
        const user = await this.getById(userid, null, '+password');

        return { email: user.email, passwordHash: user.password, user_id: user._id };
    }

    async deleteUser(userid, session = null) {
        return await this.model.findByIdAndDelete(userid, { session: session });
    }
}

module.exports = new UserRepo();