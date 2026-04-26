const AppStatsService = require('../services/stats.service');

class AppStatsController {
    /**
     * GET /stats
     * public — no auth required
     */
    async get(req, res, next) {
        try {
            const stats = await AppStatsService.getStats();
            return res.status(200).json({ status: 'ok', data: stats });
        } catch (e) {
            next(e);
        }
    }
}

module.exports = new AppStatsController();