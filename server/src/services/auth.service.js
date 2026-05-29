const { ProfileRepo, ProfileDTO } = require('../repos/profile.repo');
const { als } = require('../mw/als');
const { ApiError } = require('../mw/exception'); 
const TokenService = require('./token.service');
const UserRepo = require('../repos/user.repo');
const mongoose = require('mongoose');
const profileRepo = require('../repos/profile.repo');
const Encryptor = require('./enc.service');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

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
        const email = data?.emailAddresses?.[0]?.value;
        if (!email) return null;
        return {
            email,
            authProvider: 'google',
            avatar: avatar ?? '',
            role: 'User',
        };
    }
}

class AuthService {
    /**
     * @description generates full token pair and saves refresh token to storage
     * @param {mongoose.ObjectId} userid 
     * @returns {Promise<Object>} accessToken and refreshToken
     */
    async genTokens(userid, existingFprint = null) {
        const { fprint, claim } = existingFprint 
            ? { fprint: existingFprint, claim: Encryptor.hash(existingFprint) }
            : Encryptor.getFprint();

const accessToken = TokenService.genAccesToken(userid, null, claim); 
        let refreshToken = await UserRepo.getFreshToken(userid);

        if (!refreshToken) {
            refreshToken = TokenService.genRefreshToken(userid, fprint);
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

            const oldFprint = decoded.fprint;
            const { fprint, claim } = oldFprint
                ? { fprint: oldFprint, claim: Encryptor.hash(oldFprint) }
                : Encryptor.getFprint();

            const accessToken = TokenService.genAccesToken(userid, null, claim);
            const newRefreshToken = TokenService.genRefreshToken(userid, fprint);
            await TokenService.saveRefreshToken(userid, newRefreshToken);

            return { accessToken, refreshToken: newRefreshToken, fprint };
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
                throw ApiError.BadRequest('authentication failed', 'ERR_PASSWD_INC', null);
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

    async authenticateOAuthGoogle(data, _avatar, _displayName, refreshToken) {
        const email = data.emailAddresses[0].value;
        const authProvider = 'google';
        const avatarUrl = _avatar;
        const displayName = _displayName || '';
        const role = 'User';    
        const ssoId = data.metadata.sources[0].id;

        console.log('[OAuth] Google callback, email:', email, 'ssoId:', ssoId, 'displayName:', displayName);

        let isNewUser = true;
        let profile = {};
        let user = await UserRepo.getBySSO(ssoId);
        console.log('[OAuth] getBySSO result:', user ? user._id : 'null');
        if (!user) {
            user = await UserRepo.getByEmailHash(Encryptor.hashEmail(email));
            console.log('[OAuth] getByEmailHash result:', user ? user._id : 'null');
            isNewUser = user ? false : true;
        } else {
            isNewUser = false;
        }

        console.log('[OAuth] isNewUser:', isNewUser);

        if (isNewUser) {
            const tempUsername = `user_${Encryptor.genRandomizedString()}`;
            let regData = new regDTO(email, null, tempUsername, 'google', avatarUrl);
            regData = await Encryptor.encryptDTODefault(regData);
            console.log('[OAuth] creating user with username:', tempUsername);
            const dto = new ProfileDTO({ ...regData, isComplete: false, ssoId: ssoId, displayName });
            const {newProfile, newUser} = await ProfileRepo.createWithUser(dto);
            user = newUser;
            profile = newProfile;
            console.log('[OAuth] created user:', user._id, 'profile:', profile._id);

            const updates = {};
            if (displayName) updates.displayName = displayName;

            if (avatarUrl) {
                try {
                    console.log('[OAuth] downloading Google avatar...');
                    const imgResponse = await fetch(avatarUrl);
                    if (imgResponse.ok) {
                        const buffer = Buffer.from(await imgResponse.arrayBuffer());
                        const avatarDir = process.env.PROFILE_AVATAR_DIR || '/uploads/avatars';
                        const profileDir = path.join(avatarDir, String(profile._id));
                        await fs.promises.mkdir(profileDir, { recursive: true });
                        const filename = `${profile._id}.webp`;
                        const filepath = path.join(profileDir, filename);
                        await sharp(buffer).resize(512, 512, { fit: 'cover' }).webp().toFile(filepath);
                        updates.avatar = `${profile._id}/${filename}`;
                        console.log('[OAuth] avatar saved:', updates.avatar);
                    }
                } catch (e) {
                    console.error('[OAuth] avatar download failed:', e.message);
                }
            }

            if (Object.keys(updates).length > 0) {
                const updated = await ProfileRepo.model.findByIdAndUpdate(profile._id, { $set: updates }, { new: true }).lean();
                profile = updated;
            }
        } else {
            profile = await ProfileRepo.getByUserId(user._id);
            console.log('[OAuth] existing profile isComplete:', profile?.isComplete);
        }

        const tokens = await this.genTokens(user._id);
        console.log('[OAuth] tokens generated, redirecting...');
        return {
            ...tokens,
            user_id: user._id,
            user,
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

    /**
     * @description changes user's password after verifying the old one
     * @param {mongoose.ObjectId} userid 
     * @param {string} oldPassword 
     * @param {string} newPassword 
     * @returns {Promise<void>}
     */
    async changePassword(userid, oldPassword, newPassword) {
        const authData = await UserRepo.getAuthData(userid);
        if (!authData || !authData.passwordHash) {
            throw ApiError.BadRequest('password change not supported for OAuth accounts', 'ERR_OAUTH_PW', userid);
        }
        const ok = await Encryptor.comparePasswords(oldPassword, authData.passwordHash);
        if (!ok) {
            throw ApiError.BadRequest('incorrect current password', 'ERR_PASSWD_INC', null);
        }
        const newHash = await Encryptor.hashPassword(newPassword);
        await UserRepo.updatePassword(userid, newHash);
    }
}

module.exports = {AuthService: new AuthService(), regDTO: regDTO, loginDTO: loginDTO};
