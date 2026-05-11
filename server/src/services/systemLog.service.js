const SystemLogRepo = require('../repos/systemLog.repo');

const systemLog = {
    async write(event, details = {}, userId = null, ip = null) {
        try {
            await SystemLogRepo.log({ event, userId, details, ip });
        } catch (e) {
            console.error('[SystemLog] write error:', e.message);
        }
    },

    async list(opt) {
        return SystemLogRepo.list(opt);
    },

    async stats(since) {
        return SystemLogRepo.countByEvent(since);
    }
};

module.exports = systemLog;
