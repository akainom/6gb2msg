const { ProfileRepo } = require('../repos/profile.repo');
const UserRepo = require('../repos/user.repo');
const { ApiError } = require('../mw/exception');

class ProfileService {

    /**
     * @param {mongoose.Types.ObjectId|string} profileId
     * @returns {Promise<Object>} public profile by profileId
     */
    async getById(profileId) {
        const profile = await ProfileRepo.getById(profileId);
        if (!profile) {
            throw ApiError.NotFound('profile not found', 'ERR_PROF_NF', profileId);
        }
        return profile;
    }

    /**
     * @param {mongoose.Types.ObjectId|string} userId
     * @returns {Promise<Object>} profile by userId
     */
    async getByUserId(userId) {
        const profile = await ProfileRepo.getByUserId(userId);
        if (!profile) {
            throw ApiError.NotFound('profile not found', 'ERR_PROF_NF', userId);
        }
        return profile;
    }

    /**
     * @param {string} username
     * @returns {Promise<Object>} public profile by username
     */
    async getByUsername(username) {
        const profile = await ProfileRepo.model.findOne({ username }).lean();
        if (!profile) {
            throw ApiError.NotFound('profile not found', 'ERR_PROF_NF', username);
        }
        return profile;
    }

    /**
     * @description updates own profile fields
     * @param {mongoose.Types.ObjectId|string} userId
     * @param {{ username?: string, bio?: string, location?: string, avatar?: string, status?: string }} data
     * @returns {Promise<Object>} updated profile
     */
    async updateProfile(userId, data) {
        const profile = await ProfileRepo.getByUserId(userId);
        if (!profile) {
            throw ApiError.NotFound('profile not found', 'ERR_PROF_NF', userId);
        }

        if (data.username && data.username !== profile.username) {
            const taken = await ProfileRepo.usernameExists(data.username);
            if (taken) {
                throw ApiError.BadRequest('username already taken', 'ERR_UNAME_EX', data.username);
            }
        }

        const $set = {};
        if (data.username  !== undefined) $set.username  = data.username.trim();
        if (data.bio       !== undefined) $set.bio       = data.bio;
        if (data.location  !== undefined) $set.location  = data.location;
        if (data.avatar    !== undefined) $set.avatar    = data.avatar;
        if (data.status    !== undefined) $set.status    = data.status;

        if (Object.keys($set).length === 0) {
            throw ApiError.BadRequest('nothing to update', 'ERR_FIELDS_MISSING', null);
        }

        return ProfileRepo.model.findByIdAndUpdate(
            profile._id,
            { $set },
            { new: true, runValidators: true }
        ).lean();
    }

    /**
     * @description updates last_online and status for a user
     * called by WebSocket on connect/disconnect
     * @param {mongoose.Types.ObjectId|string} userId
     * @param {'online'|'offline'|'away'|'do not disturb'} status
     * @returns {Promise<void>}
     */
    async setOnlineStatus(userId, status) {
        const $set = { status };
        if (status === 'offline') {
            $set.last_online = new Date();
        }

        await ProfileRepo.model.findOneAndUpdate(
            { user_id: userId },
            { $set }
        );
    }

    /**
     * @description searches profiles by username prefix
     * @param {string} query
     * @param {{ limit?: number, skip?: number }} opt
     * @returns {Promise<Array>}
     */
    async search(query, opt = { limit: 20, skip: 0 }) {
        if (!query || query.trim().length < 2) {
            throw ApiError.BadRequest('search query too short', 'ERR_SEARCH_SHORT', query);
        }

        return ProfileRepo.model.find({
            username: { $regex: `^${query.trim()}`, $options: 'i' },
            isComplete: true
        })
            .select('username avatar status last_online')
            .limit(opt.limit)
            .skip(opt.skip)
            .lean();
    }

    /**
     * @description deletes own account (profile + user)
     * @param {mongoose.Types.ObjectId|string} userId
     * @param {string} password — required to confirm deletion
     * @returns {Promise<void>}
     */
    async deleteAccount(userId, password) {
        const user = await UserRepo.getById(userId, null, '+password');
        if (!user) {
            throw ApiError.NotFound('user not found', 'ERR_USR_NF', userId);
        }

        // local auth users must confirm with password
        if (user.authProvider === 'local' || !user.authProvider) {
            const bcrypt = require('bcryptjs');
            const correct = await bcrypt.compare(password, user.password);
            if (!correct) {
                throw ApiError.BadRequest('incorrect password', 'ERR_PASSWD_INC', null);
            }
        }

        const profile = await ProfileRepo.getByUserId(userId);
        if (!profile) {
            throw ApiError.NotFound('profile not found', 'ERR_PROF_NF', userId);
        }

        await ProfileRepo.deleteProfileWithUser(profile._id);
    }
}

module.exports = new ProfileService();