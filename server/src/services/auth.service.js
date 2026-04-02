const Profile = require('../models/profile');
const { ProfileRepo, ProfileDTO } = require('../repos/profile.repo');
const bcrypt = require('bcryptjs');
const { als } = require('./als');
const TokenService = require('./token.service');

class regDTO {
    /**
     * @param {string} _email 
     * @param {string} _password 
     * @param {string} _username 
     * @param {string} _authProvider 
     * @param {string} _avatar 
     * @param {string} _role 
     */
    constructor(_email, _password, _username, _authProvider, _avatar, _role) {
        this.email = _email;
        this.password = _password;
        this.username = _username;
        this.authProvider = _authProvider;
        this.avatar = _avatar;
        this.role = _role;
        this.createdAt = new Date();
    }
}

class Encryptor {
    /**
     * @description encrypts sensitive DTO fields before storage
     * @param {regDTO} dto 
     * @returns {Promise<Object>} DTO with hashed password
     */
    static async encryptDTODefault(dto) {
        return {
            ...dto,
            password: await bcrypt.hash(dto.password, 10),
        }
    }
}

class AuthService {
    /**
     * @description generates full token pair and saves refresh token to storage
     * @param {mongoose.ObjectId} userid 
     * @returns {Promise<Object>} accessToken and refreshToken
     */
    async genTokens(userid) {
        const accessToken = TokenService.genAccesToken(userid);
        const refreshToken = TokenService.genRefreshToken(userid);

        await TokenService.saveRefreshToken(userid, refreshToken);

        return { accessToken, refreshToken };
    }

    /**
     * @description exchanges valid refresh token for a new access token
     * @param {mongoose.ObjectId} userid 
     * @param {string} refreshToken 
     * @returns {Promise<string|null>} new access token
     */
    async exchangeRefreshToken(userid, refreshToken) {
        const decoded = await TokenService.verifyRefreshToken(refreshToken);
        if (!decoded) return null;
        
        const isValid = await TokenService.validateToken(userid, refreshToken);
        if (!isValid) return null;

        return TokenService.genAccesToken(userid);
    }

    /**
     * @description rotates refresh token by removing old one and generating new
     * @param {mongoose.ObjectId} userid 
     * @param {string} oldRefreshToken 
     * @returns {Promise<string|null>} new refresh token
     */
    async getNewRefreshToken(userid, oldRefreshToken) {
        const decoded = await TokenService.verifyRefreshToken(oldRefreshToken);
        if (!decoded) return null;
        
        const isValid = await TokenService.validateToken(userid, oldRefreshToken);
        if (!isValid) return null;

        await TokenService.removeToken(userid, oldRefreshToken);
        
        const newRefreshToken = TokenService.genRefreshToken(userid);
        await TokenService.saveRefreshToken(userid, newRefreshToken);

        return newRefreshToken;
    }
    
    /**
     * @description registers new user, creates profile and generates auth tokens
     * @param {regDTO} data 
     * @returns {Promise<Object>} profile, newUser and token pair
     */
    async registerUser(data) {
        const regDTO = await Encryptor.encryptDTODefault(data);
        const profileDTO = new ProfileDTO(regDTO);

        const {profile, newUser} = await ProfileRepo.createWithUser(profileDTO);

        /* NO STORE IN DEBUG
           idc somewhere else store is called
        const store = als.getStore();
        store.set('user', newUser);
        store.set('profile', profile);
        */

        const {accessToken, refreshToken} = await this.genTokens(newUser._id);

        return {profile, newUser, accessToken, refreshToken};
    }
}

module.exports = {AuthService: new AuthService(), regDTO: regDTO};