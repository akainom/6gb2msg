const AppStatsService = require('../services/stats.service');
const systemLog = require('../services/systemLog.service');
const { getUserId } = require('../mw/request');
const userRepo = require('../repos/user.repo');
const { ApiError } = require('../mw/exception');

class AppStatsController {
    async get(req, res, next) {
        try {
            const stats = await AppStatsService.getStats();
            return res.status(200).json({ status: 'ok', data: stats });
        } catch (e) {
            next(e);
        }
    }

    async listLogs(req, res, next) {
        try {
            const userId = getUserId(req);
            const user = await userRepo.getById(userId);
            if (!user || user.role !== 'Admin') {
                throw ApiError.Forbidden('admin only', 'ERR_ADMIN_ONLY', null);
            }

            const limit = Math.min(parseInt(req.query.limit) || 50, 200);
            const skip = parseInt(req.query.skip) || 0;
            const event = req.query.event || null;

            const logs = await systemLog.list({ limit, skip, event });
            return res.status(200).json({ status: 'ok', data: logs });
        } catch (e) {
            next(e);
        }
    }
}

module.exports = new AppStatsController();
