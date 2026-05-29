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
    /**
     * @param {mongoose.Model} model
     */
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
     * @description checks whether a user with the given email already exists
     * @param {string} email 
     * @returns {Promise<Boolean>} true if exists, false otherwise
     */
    async emailExists(email) {
        const emailExists = await this.model.exists({ email });

        return emailExists ? true : false;
    }

    /**
     * @description retrieves the user ID for a given email address
     * @param {string} email 
     * @returns {Promise<Object|null>} user document with only _id or null
     */
    async getUserId(email) {
        const userid = await this.model.findOne({ email }).select('_id').lean();

        return userid ? userid : null;
    }

    /**
     * @description fetches a user by their SSO identifier
     * @param {string} ssoId 
     * @returns {Promise<Object|null>} plain user object or null
     */
    async getBySSO(ssoId) {
        const user = await this.model.findOne({ ssoId }).lean();

        return user ? user : null;
    }

    /**
     * @description fetches a user by their hashed email address
     * @param {string} email 
     * @returns {Promise<Object|null>} plain user object or null
     */
    async getByEmailHash(email) {
        const user = await this.model.findOne({ emailHash: email }).lean();

        return user ? user : null;
    }

    /**
     * @description retrieves authentication data (email, password hash, id) for a user
     * @param {mongoose.ObjectId} userid 
     * @returns {Promise<Object>} object containing email, passwordHash, and user_id
     */
    async getAuthData(userid) {
        const user = await this.getById(userid, null, '+password');

        return { email: user.email, passwordHash: user.password, user_id: user._id, role: user.role, authProvider: user.authProvider, isBanned: user.isBanned, bannedUntil: user.bannedUntil, banReason: user.banReason };
    }

    /**
     * @description updates the user's password hash
     * @param {mongoose.ObjectId} userid 
     * @param {string} newPasswordHash 
     * @returns {Promise<void>}
     */
    async updatePassword(userid, newPasswordHash) {
        await this.model.updateOne(
            { _id: userid },
            { $set: { password: newPasswordHash } }
        );
    }

    /**
     * @description deletes a user document by ID
     * @param {mongoose.ObjectId} userid 
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Object|null>} deleted user document or null
     */
    async deleteUser(userid, session = null) {
        return await this.model.findByIdAndDelete(userid, { session: session });
    }

    /**
     * @description bans a user by setting ban-related fields
     * @param {mongoose.ObjectId} userId 
     * @param {string} reason 
     * @param {Date} unbanDate 
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Object|null>} updated user document
     */
    async banUser(userId, reason, unbanDate, session = null) {
        return await this.model.findByIdAndUpdate(
            userId,
            { 
                $set: { 
                    isBanned: true, 
                    banReason: reason, 
                    bannedUntil: unbanDate
                } 
            },
            { new: true, session }
        ).lean();
    }

    /**
     * @description lifts a ban from a user by clearing ban-related fields
     * @param {mongoose.ObjectId} userId 
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Object|null>} updated user document
     */
    async unbanUser(userId, session = null) {
        return await this.model.findByIdAndUpdate(
            userId,
            { 
                $set: { 
                    isBanned: false, 
                    banReason: null, 
                    bannedUntil: null 
                } 
            },
            { new: true, session }
        ).lean();
    }
}

module.exports = new UserRepo();
