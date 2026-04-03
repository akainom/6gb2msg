const { ProfileRepo, ProfileDTO } = require('../repos/profile.repo');
const bcrypt = require('bcryptjs');
const { als } = require('../mw/als');
const { ApiError } = require('../mw/exception'); 
const TokenService = require('./token.service');
const UserRepo = require('../repos/user.repo');

class loginDTO {
    /**
     * 
     * @param {string} _username 
     * @param {string} _password 
     */
    constructor(_username, _email, _password) {
        this.username = _username;
        this.password = _password;
        
    }
}

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

    static async comparePasswords(password, hash) {
        return await bcrypt.compare(password, hash);
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
     * @returns {Promise<Object|null>} new tokens
     */
    async exchangeRefreshToken(userid, refreshToken) {
        try {
            const decoded = await TokenService.verifyRefreshToken(refreshToken);
            
            if (!decoded) return null;
            const isValid = await TokenService.validateToken(userid, refreshToken);
            if (!isValid) return null;
            await TokenService.removeToken(userid, refreshToken);

            return await this.genTokens(userid);
        } catch (e) {
            if (e.code) return false; 
            throw ApiError.BadRequest('exchange failed', 'ERR_EXC_FAIL', { userid, refreshToken });
        }
    }

    /**
     * @description rotates refresh token by removing old one and generating new
     * @param {mongoose.ObjectId} userid 
     * @param {string} oldRefreshToken 
     * @returns {Promise<string|null>} new refresh token
     */
    async getNewRefreshToken(userid, oldRefreshToken) {
        try {
            const decoded = await TokenService.verifyRefreshToken(oldRefreshToken);
            if (!decoded) return null;
            
            const isValid = await TokenService.validateToken(userid, oldRefreshToken);
            if (!isValid) return null;

            await TokenService.removeToken(userid, oldRefreshToken);
            
            const newRefreshToken = TokenService.genRefreshToken(userid);
            await TokenService.saveRefreshToken(userid, newRefreshToken);

            return newRefreshToken;
        } catch (e) {
            throw ApiError.BadRequest('refresh token invalid', 'ERR_TKN_INV', oldRefreshToken);
        }
    }
    
    /**
     * @description registers new user, creates profile and generates auth tokens
     * @param {regDTO} data 
     * @returns {Promise<Object>} profile, new user and token pair
     */
    async registerUser(data) {
        const regDTO = await Encryptor.encryptDTODefault(data);

        if (await UserRepo.emailExists(data.email)) {
            throw ApiError.BadRequest('registration failed', 'ERR_EMAIL_EX', data.email);
        }
        
        if (await ProfileRepo.usernameExists(data.username)) {
            throw ApiError.BadRequest('registration failed', 'ERR_UNAME_EX', data.username);
        }

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

    /**
     * @description verifies provided auth data
     * @param {loginDTO} data 
     * @returns {Promise<Object>} access token, 
     */
    async login(data) {
        try {
            const authCtx = await ProfileRepo.getAuthContext(data.username);
            if (!authCtx) {
                throw ApiError.NotFound('authentication failed', 'ERR_USR_NF', data.username)
            }

            const passwordCorrect = await Encryptor.comparePasswords(data.password, authCtx.user.passwordHash);
            if (!passwordCorrect) {
                throw ApiError.BadRequest('authentication failed', 'ERR_PASSWD_INC', data.password);
            } else {
                // success login
                const tokens = await this.genTokens(authCtx.user_id);
                const { 
                    user: { passwordHash, ...safeUser },
                    ...safeUserData
                } = authCtx
                return { accessToken: tokens.accessToken, ...safeUserData, user: safeUser };
            }
        }
        catch (e) {
            if (e instanceof ApiError) throw e;
            throw ApiError.BadRequest('authentication failed', 'ERR_CRED_INC', data.username);
        }
    }
}

module.exports = {AuthService: new AuthService(), regDTO: regDTO, loginDTO: loginDTO};