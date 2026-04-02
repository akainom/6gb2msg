const mongoose = require('mongoose');
const Base = require('./base.repo');
const Profile = require('../models/profile');
const User = require('../models/user');
const { als } = require('../services/als');

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
     * @description transactional creation of user and related profile
     * @param {ProfileDTO} dto 
     * @returns new user profile
    */
    async createWithUser(dto) {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const [newUser] = await User.create([dto.user], { session });

            console.log(`new user: \n${JSON.stringify(newUser)}`);

            const profile = await this.createForExistingUser(newUser._id, dto, session);

            await session.commitTransaction();
            return {profile, newUser};
        } catch (e) {
            await session.abortTransaction();
            throw e;
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
            throw new Error(`FATAL: profile ${profile._id} w/o reference to users`);
        }

        return user;
    }
    
    /**
     * 
     * @param {mongoose.ObjectId} profileid 
     * @param {mongoose.ClientSession} session 
     * @returns {Promise<mongoose.ObjectId>} related user id
     */
    async getUserId(profileid, session = null) {
        const user = await this.getUser(profileid, session);
        return user ? user._id : null;
    }
}

module.exports = {ProfileRepo: new ProfileRepo(), ProfileDTO: ProfileDTO};
