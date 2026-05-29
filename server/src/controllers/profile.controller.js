const ProfileService = require('../services/profile.service');
const { ApiError } = require('../mw/exception');
const { getUserId, getProfileId } = require('../mw/request');
const systemLog = require('../services/systemLog.service');

class ProfileController {

    /**
     * GET /profiles/search?q=...&limit=...&skip=...
     */
    async search(req, res, next) {
        try {
            const { q } = req.query;
            const limit = parseInt(req.query.limit) || 20;
            const skip = parseInt(req.query.skip) || 0;

            const result = await ProfileService.search(q, { limit, skip });

            return res.status(200).json({ status: 'ok', data: result });
        } catch (e) {
            next(e);
        }
    }

    /**
     * GET /profiles/:profileId
     */
    async getOne(req, res, next) {
        try {
            let { profileId } = req.params;

            if (profileId === 'me') {
                profileId = getProfileId(req);
            }

            const profile = await ProfileService.getById(profileId);

            return res.status(200).json({ status: 'ok', data: profile });
        } catch (e) {
            next(e);
        }
    }

    /**
     * GET /profiles/by-user/:userId
     */
    async getByUserId(req, res, next) {
        try {
            const { userId } = req.params;

            const profile = await ProfileService.getByUserId(userId);

            return res.status(200).json({ status: 'ok', data: profile });
        } catch (e) {
            next(e);
        }
    }

    /**
     * PATCH /profiles/me
     * body: { username?, bio?, location?, avatar?, status? }
     */
    async update(req, res, next) {
        try {
            const userId = getUserId(req);
            const { username, displayName, bio, location, avatar, status } = req.body;

            const profile = await ProfileService.updateProfile(userId, {
                username, displayName, bio, location, avatar, status
            });

            systemLog.write('profile:update', { fields: Object.keys(req.body).filter(k => req.body[k] !== undefined) }, userId, req.ip);

            const io = req.app.get('io');
            if (io) {
                const chatRepo = require('../repos/chat.repo');
                const chats = await chatRepo.getByUserId(userId, { limit: 100, skip: 0 });
                const roomIds = chats.map(c => `chat:${c._id}`);
                for (const roomId of roomIds) {
                    io.to(roomId).emit('user:status', {
                        userId: String(userId),
                        status: profile.status,
                        profile_id: String(profile._id),
                        username: profile.username,
                        displayName: profile.displayName,
                        updatedAt: profile.updatedAt,
                    });
                }
            }

            return res.status(200).json({ status: 'ok', data: profile });
        } catch (e) {
            next(e);
        }
    }

    /**
     * DELETE /profiles/me
     * body: { password }
     */
    async delete(req, res, next) {
        try {
            const userId = getUserId(req);
            const { password } = req.body;

            if (!password) {
                throw ApiError.BadRequest('password required', 'ERR_FIELDS_MISSING', null);
            }

            await ProfileService.deleteAccount(userId, password);

            return res.status(200).json({ status: 'ok' });
        } catch (e) {
            next(e);
        }
    }
}
module.exports = new ProfileController();

