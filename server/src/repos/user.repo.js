const { default: mongoose } = require('mongoose');
const User = require('../models/user');
const Base = require('./base.repo');

class UserRepository extends Base {
    constructor() {
        super(User)
    }

    /**
    *@async
    *@description pulls 'refreshTokens' field 
    *@returns { Promise<Object> } refreshTokens[]
    **/
    async getTokens(userid) {
        const tokens = await this.model.findById(userid)
        .select('refreshTokens')
        .lean() ?? [];
        return tokens;
    }

    /**
    *@async
    *@description checks if specified refreshToken belongs to user
    *@returns { Promise<Boolean> } true if so, false if not
    **/
    async hasToken(userid, refreshToken) {
        const user = await this.model.findOne({
            _id: userid,
            refreshTokens: { $elemMatch: { token: refreshToken } }
        });

        return !!user;
    }

    /**
     * @param {string} userid 
     * @param {string} tokenData
     * @param {mongoose.ClientSession} [session=null] 
    * @async
    * @description trying to push new token to user's tokens
    * @returns { Promise<Object | null> } updated user info
    **/
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
    *@async
    *@description removes specified refresh token from user's tokens
    *@returns { Promise<Object> } updated user info
    **/
    async removeToken(userid, refreshToken, session = null) {
        return await this.model.findByIdAndUpdate(userid, 
            { $pull: { refreshTokens: { token: refreshToken } } },
            { session, new: true }
        ).lean();
    }

    /**
    *@async
    *@description removes all refresh tokens that user has
    *@returns { Promise<Object> } updated user info
    **/
    async removeAllTokens(userid, session = null) {
        return await this.model.findByIdAndUpdate(userid,
            { $set: { refreshTokens: [] } },
            { session, new: true }
        ).lean()
    }
}

module.exports = UserRepository;