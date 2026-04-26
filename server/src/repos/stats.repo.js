const AppStats = require('../models/appStat');

class AppStatsRepo {
    /**
     * @returns {Promise<Object|null>} latest stats snapshot
     */
    async get() {
        return AppStats.findOne({ _key: 'global' }).lean();
    }

    /**
     * @param {Object} data
     * @returns {Promise<Object>} upserted snapshot
     */
    async upsert(data) {
        return AppStats.findOneAndUpdate(
            { _key: 'global' },
            { $set: { ...data, computed_at: new Date() } },
            { new: true, upsert: true }
        ).lean();
    }
}

module.exports = new AppStatsRepo();