const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserRepo = require('../repos/user.repo');
const User = require('../models/user');

const HASH_ROUNDS = 10;
const REFRESH_EXPIRES_SECONDS = 15 * 24 * 60 * 60;

class AuthService {
    genAccesToken(userid, expiresIn = null) {
        return jwt.sign(
            { userid },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: expiresIn ?? '30m' }
        );
    }

    genRefreshToken(userid, expiresIn = null) {
        return jwt.sign(
            { userid },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: expiresIn ?? '15d' }
        );
    }

    async genTokens(userid) {
        const accessToken = this.genAccesToken(userid);
        const refreshToken = this.genRefreshToken(userid);

        await UserRepo.addToken(userid, {
            token: refreshToken,
            expiresAt: new Date(Date.now() + (15*24*60*60*1000))
        })

        return { accessToken, refreshToken };
    }

    async exchangeRefreshToken(userid, refreshToken) {
        if (!await UserRepo.hasToken(userid, refreshToken)) {
            return null;
        }

        return this.genAccesToken(userid);
    }

    async getNewRefreshToken(userid, oldRefreshToken) {
        if (!await UserRepo.hasToken(userid, oldRefreshToken)) {
            return null;
        }

        await UserRepo.removeToken(userid, oldRefreshToken);
        const newRefreshToken = this.genRefreshToken(userid, REFRESH_EXPIRES_SECONDS);
        await UserRepo.addToken(userid, { 
            token: newRefreshToken,
            expiresAt: Date.now() + REFRESH_EXPIRES_SECONDS * 1000
         })
    }

}