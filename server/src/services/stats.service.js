const User = require('../models/user');
const Profile = require('../models/profile');
const Chat = require('../models/chats');
const Message = require('../models/messages');
const AppStatsRepo = require('../repos/stats.repo');

class AppStatsService {

    /**
     * @description computes fresh stats via mongo aggregations and persists snapshot
     * @returns {Promise<Object>}
     */
    async recompute() {
        const now = new Date();
        const oneDayAgo  = new Date(now - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now -  7 * 24 * 60 * 60 * 1000);

        const [
            totalUsers,
            activeToday,
            activeWeek,
            totalChats,
            privateChats,
            groupChats,
            totalMessages,
            messagesDay,
            messagesWeek,
        ] = await Promise.all([
            User.countDocuments(),
            Profile.countDocuments({ last_online: { $gte: oneDayAgo } }),
            Profile.countDocuments({ last_online: { $gte: oneWeekAgo } }),
            Chat.countDocuments(),
            Chat.countDocuments({ type: 'private' }),
            Chat.countDocuments({ type: 'group' }),
            Message.countDocuments(),
            Message.countDocuments({ createdAt: { $gte: oneDayAgo } }),
            Message.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
        ]);

        const snapshot = {
            users: {
                total:        totalUsers,
                active_today: activeToday,
                active_week:  activeWeek,
            },
            chats: {
                total:   totalChats,
                private: privateChats,
                group:   groupChats,
            },
            messages: {
                total:     totalMessages,
                last_24h:  messagesDay,
                last_week: messagesWeek,
            },
        };

        return AppStatsRepo.upsert(snapshot);
    }

    /**
     * @description returns latest persisted snapshot
     * if collection is empty (first boot) — computes
     * @returns {Promise<Object>}
     */
    async getStats() {
        const existing = await AppStatsRepo.get();
        if (existing) return existing;
        return this.recompute();
    }

    /**
     * @description starts periodic recompute job
     * @param {number} intervalMs default 15 minutes
     * @returns {Function} stop function
     */
    startJob(intervalMs = 15 * 60 * 1000) {
        console.log(`[AppStats] job started, interval ${intervalMs / 60000}min`);

        this.recompute()
            .then(() => console.log('[AppStats] initial snapshot saved'))
            .catch(e => console.error('[AppStats] initial compute failed:', e.message));

        const timer = setInterval(() => {
            this.recompute()
                .then(() => console.log('[AppStats] snapshot updated'))
                .catch(e => console.error('[AppStats] recompute failed:', e.message));
        }, intervalMs);

        timer.unref();
        return () => clearInterval(timer);
    }
}

module.exports = new AppStatsService();