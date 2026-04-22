const ProfileService = require('../services/profile.service');
const { ApiError } = require('../mw/exception');
const { getUserId } = require('../mw/request');

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
            const { profileId } = req.params;

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
            const { username, bio, location, avatar, status } = req.body;

            const profile = await ProfileService.updateProfile(userId, {
                username, bio, location, avatar, status
            });

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