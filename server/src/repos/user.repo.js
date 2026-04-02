const { default: mongoose } = require('mongoose');
const User = require('../models/user');
const Base = require('./base.repo');

class UserRepository extends Base {
    constructor() {
        super(User);
    }

    /**
     * @description pulls 'refreshTokens' field for specified user
     * @param {mongoose.ObjectId} userid 
     * @returns {Promise<Array>} array of refresh token objects
     */
    async getTokens(userid) {
        const user = await this.model.findById(userid)
            .select('refreshTokens')
            .lean();
        
        return user?.refreshTokens ?? [];
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
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Object|null>} updated user document
     */
    async removeAllTokens(userid, session = null) {
        return await this.model.findByIdAndUpdate(
            userid,
            { $set: { refreshTokens: [] } },
            { session, new: true }
        ).lean();
    }
}

module.exports = new UserRepository();