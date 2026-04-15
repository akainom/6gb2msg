const mongoose = require('mongoose');
const Base = require('./base.repo');
const Profile = require('../models/profile');
const User = require('../models/user');
const userRepo = require('./user.repo');
const { als } = require('../mw/als');
const { ApiError } = require('../mw/exception');
const es = require('../search/es.client');
const { mapProfile } = require('../search/es.mapper');

class ProfileDTO {
    constructor(data) {
        this.user = {};
        this.user.email = data.email ?? '';
        this.user.emailHash = data.emailHash ?? '';
        this.user.password = data.password ?? '';
        this.user.authProvider = data.authProvider ?? '';
        this.user.role = data.role ?? '';
        if (data.ssoId) {
            this.user.ssoId = data.ssoId;
        }
        this.user.createdAt = new Date();

        this.username = data.username ?? '';
        this.avatar = '';
        this.bio = data.bio ?? '';
        this.location = data.location ?? '';
        this.status = data.status ?? '';
        this.last_online = new Date()
        this.isComplete = data.isComplete ?? false;
    }
}

class ProfileRepo extends Base {
    constructor() {
        super(Profile);
    }

    /**
     * 
     * @param {mongoose.ObjectId} userid 
     * @returns related user profile
     */
    async getByUserId(userid) {
        const profile = await this.model.findOne({ user_id: userid }).lean();

        return profile;
    }
    
    /**
     * @description deletes profile and related user
     * @param {mongoose.ObjectId} profileid  
     * @returns {Promise<mongoose.ObjectId} deleted profile id
     */
    async deleteProfileWithUser(profileid) {
        const session = await mongoose.startSession();
        await session.startTransaction();
        try {
            const user_id = await this.getUserId(profileid, session);
            await userRepo.deleteUser(user_id, session);
            await this.model.findByIdAndDelete(profileid, { session: session });
            
            await session.commitTransaction();
            
            try {
                await es.delete({
                    index: process.env.ELASTIC_INDEX_PROFILES || 'profiles_v1',
                    id: String(profileid)
                });
            } catch (e) {
                if (e?.meta?.statusCode !== 404) {
                    console.error('[ES] Profile delete error:', e.message);
                }
            }
            
            return profileid;
        }
        catch (e) {
            await session.abortTransaction()

            throw new Error(`profile delete failed`, {
                cause: { code: 'ERR_PROF_DEL', val: profileid }
            });
        }
        finally {
            await session.endSession();
        }
    }

    /**
     * @description transactional creation of user and related profile
     * @param {ProfileDTO} dto 
     * @returns new user and profile
    */
    async createWithUser(dto) {
        const client = User.db.getClient();
        const session = client.startSession();
        session.startTransaction();
        try {
            const newUser = new User(dto.user);
            await newUser.save({ session });

            const newProfile = await this.createForExistingUser(newUser._id, dto, session);

            await session.commitTransaction();
            return {newProfile, newUser};
        } catch (e) {
            await session.abortTransaction();
            console.error('createWithUser error:', e);
            if (e instanceof ApiError) throw e;
            if (e.code === 11000) {

                const field = Object.keys(e.keyPattern)[0];
                if (field === 'emailHash' || field === 'email') {
                    throw ApiError.BadRequest('registration failed', 'ERR_EMAIL_EX', null);
                }
                if (field === 'username') {
                    throw ApiError.BadRequest('registration failed', 'ERR_UNAME_EX', null);
                }
                throw ApiError.BadRequest('duplicate field', 'ERR_DUPLICATE', field);
            }
            throw ApiError.BadRequest('profile create failed', 'ERR_PROF_CRT', null);
        } finally {
            await session.endSession();
        }
    }

    
    /**
     * @description creates profile from existing user record
     * @param {mongoose.ObjectId} userId 
     * @param {ProfileDTO} dto 
     * @param {mongoose.ClientSession} session 
     * @returns new user profile
     */
    async createForExistingUser(userId, dto, session = null) {
        const [profile] = await this.model.create([{
            user_id: userId,
            username: dto.username,
            avatar: dto.avatar,
            bio: dto.bio,
            location: dto.location,
            status: dto.status,
            last_online: dto.last_online,
            isComplete: dto.isComplete
        }], { session });

        if (dto.isComplete === true) {
            es.index({
                index: process.env.ELASTIC_INDEX_PROFILES || 'profiles_v1',
                id: String(profile._id),
                document: mapProfile(profile.toObject())
            }).catch(e => console.error('[ES] Profile sync error:', e.message));
        }

        return profile;
    }

    /**
     *
     * @param {mongoose.ObjectId} profileid 
     * @param {mongoose.ClientSession} session 
     * @returns related user
     */
    async getUser(profileid, session = null) {
        const store = als.getStore();

        const profile = store?.get('profile') ?? await this.getById(profileid).session(session);
        if (!profile) {
            return null;
        } 

        const user = await profile.getUser(session);
        if (!user) {
            throw new ApiError(`FATAL: profile ${profile._id} w/o reference to users`, 500, 'ERR_DB_INTEGRITY');
        }

        return user;
    }
    
    /**
     * 
     * @param {string} username  
     * @returns {Promise<mongoose.ObjectId>} related user id
     */
    async getUserId(profileid, session = null) {
        const profile = await this.getById(profileid, session, 'user_id');

        return profile ? profile.user_id : null;
    }

    /**
     * 
     * @param {string} username 
     * @returns {Promise<Boolean>} true if exists, false otherwise
     */
    async usernameExists(username) {
        const usernameExists = await this.model.exists({ username });

        return usernameExists ? true : false;
    }

    /**
     * @description finalizes OAuth signup, sets isComplete
     * @param {mongoose.Types.ObjectId|string} userId
     * @param {{ username: string, bio?: string, location?: string, avatar?: string }} data
     * @returns {Promise<Object>} updated profile (plain)
     */
    async finalizeProfile(userId, data) {
        const { username, bio, location, avatar } = data;

        const profile = await this.getByUserId(userId);
        
        if (!profile) {
            throw ApiError.NotFound('profile not found', 'ERR_PROF_NF', userId);
        }
        if (profile.isComplete) {
            throw ApiError.BadRequest('profile already complete', 'ERR_PROF_DONE', null);
        }

        const taken = await this.usernameExists(username);
        if (taken) {
            throw ApiError.BadRequest('username taken', 'ERR_UNAME_EX', username);
        }

        const $set = { username: username, isComplete: true };
        if (bio !== undefined) $set.bio = bio;
        if (location !== undefined) $set.location = location;
        if (avatar !== undefined) $set.avatar = avatar;

        return await this.model.findByIdAndUpdate(
            profile._id,
            { $set },
            { new: true, runValidators: true }
        ).lean();
    }

    /**
     * 
     * @param {string} username 
     * @returns {Promise<Object>} object, containing public profile and **sensitive** auth data 
     */
    async getAuthContext(username) {
        const profile = await this.model.findOne({ username }).lean();
        if (!profile) return null;

        const userData = await userRepo.getAuthData(profile.user_id);
        const AuthCtx = {
            ...profile,
            user: userData
        }

        return AuthCtx;
    }

}

module.exports = {ProfileRepo: new ProfileRepo(), ProfileDTO: ProfileDTO};
