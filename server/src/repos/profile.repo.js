const mongoose = require('mongoose');
const Base = require('./base.repo');
const Profile = require('../models/profile');
const User = require('../models/user');
const { als } = require('../mw/als');
const userRepo = require('./user.repo');

class ProfileDTO {
    constructor(data) {
        this.user = {};
        this.user.email = data.email ?? '';
        this.user.password = data.password ?? '';
        this.user.authProvier = data.authProvier ?? '';
        this.user.role = data.role ?? '';
        this.user.createdAt = new Date();

        this.username = data.username ?? '';
        this.avatar = data.avatar ?? '';
        this.bio = data.bio ?? '';
        this.location = data.location ?? '';
        this.status = data.status ?? '';
        this.last_online = new Date()
    }
}

class ProfileRepo extends Base {
    constructor() {
        super(Profile);
    }

    /**
     * 
     * @param {string} username 
     * @returns related user profile
     */
    async getByUsername(username) {
        const profile = await this.model.findOne({ username: username }).lean();

        return profile;
    }

    /**
     * @description transactional creation of user and related profile
     * @param {ProfileDTO} dto 
     * @returns new user profile
    */
    async createWithUser(dto) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const [newUser] = await User.create([dto.user], { session });

            const profile = await this.createForExistingUser(newUser._id, dto, session);

            await session.commitTransaction();
            return {profile, newUser};
        } catch (e) {
            await session.abortTransaction();
            throw ApiError.BadRequest('profile delete failed', 'ERR_PROF_DEL', profileid);
        } finally {
            await session.endSession();
        }
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
            
            session.commitTransaction();
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
            last_online: dto.last_online
        }], { session });

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
