const { ProfileRepo, ProfileDTO } = require('../repos/profile.repo');
const { als } = require('../mw/als');
const { ApiError } = require('../mw/exception'); 
const TokenService = require('./token.service');
const UserRepo = require('../repos/user.repo');
const mongoose = require('mongoose');
const profileRepo = require('../repos/profile.repo');
const Encryptor = require('./enc.service');

class loginDTO {
    /**
     * 
     * @param {string} _username 
     * @param {string} _password 
     */
    constructor(_username, _password) {
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
        this.avatar = _avatar ?? 'transparent.png';
        this.role = _role ?? 'User';
        this.createdAt = new Date();
    }

    static fromGoogleProfile(data, avatar) {
        const params = {
            email: data.emailAddresses[0].value,
            authProvider: 'google',
            avatar: avatar,
            role: 'User',    
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
        const { fprint, claim } = Encryptor.getFprint();

        const accessToken = TokenService.genAccesToken(userid, null, claim); 
        let refreshToken = await UserRepo.getFreshToken(userid);

        if (!refreshToken) {
            refreshToken = TokenService.genRefreshToken(userid);
            await TokenService.saveRefreshToken(userid, refreshToken);
        }

        return { accessToken, refreshToken, fprint }; 
    }

    /**
     * @description exchanges valid refresh token for a new access token
     * @param {mongoose.ObjectId} userid 
     * @param {string} refreshToken 
     * @returns {Promise<Object|null>} new tokens
     */
    async exchangeRefreshToken(refreshToken) {
        try {
            const decoded = await TokenService.verifyRefreshToken(refreshToken);
            
            if (!decoded) return null;
            const userid = decoded.userid;
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

        if (await UserRepo.getByEmailHash(Encryptor.hashEmail(data.email))) {
            throw ApiError.BadRequest('email exists', 'ERR_EMAIL_EX', data.email);
        }
        
        if (await ProfileRepo.usernameExists(data.username)) {
            throw ApiError.BadRequest('username exists', 'ERR_UNAME_EX', data.username);
        }

        const profileDTO = new ProfileDTO({...regDTO, isComplete: true});

        const {newProfile, newUser} = await ProfileRepo.createWithUser(profileDTO);

        const {accessToken, refreshToken, fprint} = await this.genTokens(newUser._id);

        return {profile: newProfile, user: newUser, accessToken, refreshToken, fprint};
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
                return { ...tokens,  ...safeUserData, user: safeUser };
            }
        }
        catch (e) {
            if (e instanceof ApiError) throw e;
            throw ApiError.BadRequest('authentication failed', 'ERR_CRED_INC', data.username);
        }
    }

    async authenticateOAuthGoogle(data, _avatar, refreshToken) {
        const email = data.emailAddresses[0].value;
        const authProvider = 'google';
        const avatar = _avatar;
        const role = 'User';    
        const ssoId = data.metadata.sources[0].id;

        let isNewUser = true;
        let profile = {};
        let user = await UserRepo.getBySSO(ssoId);
        if (!user) {
            user = await UserRepo.getByEmailHash(Encryptor.hashEmail(email));
            isNewUser = user ? false : true;
        } else {
            isNewUser = false;
        }

        if (isNewUser) {
            const tempUsername = `user_${Encryptor.genRandomizedString()}`;
            let regData = new regDTO(email, null, tempUsername, 'google', avatar);
            regData = await Encryptor.encryptDTODefault(regData);
            const {newProfile, newUser} = await ProfileRepo.createWithUser(new ProfileDTO({ ...regData, isComplete: false, ssoId: ssoId }));
            user = newUser;
            profile = newProfile;
        } else {
            profile = await ProfileRepo.getByUserId(user._id);
        }

        const tokens = await this.genTokens(user._id);
        return {
            ...tokens,
            user_id: user._id,
            profile,
        }
    }

    /**
     * 
     * @param {mongoose.ObjectId} userid 
     * @param {{ username: string, bio?: string, location?: string, avatar?: string }} data 
     * @returns {Promise<Object>} updated profile (plain)
     */
    async completeOAuthRegistration(userid, data) {
        try {
            return await ProfileRepo.finalizeProfile(userid, data);
        } catch (e) {
            if (e instanceof ApiError) throw e;
            throw ApiError.BadRequest('unable to complete profile', 'ERR_PROF_!COMPL', {userid});
        }
    }

    /**
     * @param {mongoose.ObjectId} userid 
     * @param {string} refreshToken 
     * @returns {Promise<Boolean>} true if token removed 
     */
    async logout(userid, refreshToken) {
        try {
            await UserRepo.removeToken(userid, refreshToken);
            return true;
        } catch (e) {
            throw ApiError.BadRequest(`incorrect token or user id`, `ERR_REFR_INC`, { userid, refreshToken });
        }
    }

    /**
     * @param {mongoose.ObjectId} userid
     * @returns {Promise<Boolean>} true if tokens removed 
     */
    async logoutAllTokens(userid) {
        try {
            await UserRepo.removeAllTokens(userid);
            return true;
        } catch (e) {
            throw ApiError.BadRequest(`unable to remove tokens`, `ERR_REFR_ALL_FAIL`, userid);
        }
    }
}

module.exports = {AuthService: new AuthService(), regDTO: regDTO, loginDTO: loginDTO};