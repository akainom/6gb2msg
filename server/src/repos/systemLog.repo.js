const mongoose = require('mongoose');
const Base = require('./base.repo');
const SystemLog = require('../models/systemLog');

class SystemLogRepo extends Base {
    constructor() {
        super(SystemLog);
    }

    async log({ event, userId = null, details = {}, ip = null }) {
        return this.create({ event, userId, details, ip });
    }

    async list(opt = { limit: 50, skip: 0, event: null }) {
        const filter = {};
        if (opt.event) filter.event = opt.event;

        return this.model.find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.min(opt.limit, 200))
            .skip(opt.skip)
            .lean();
    }

    async countByEvent(since = null) {
        const filter = {};
        if (since) filter.createdAt = { $gte: since };

        return this.model.aggregate([
            { $match: filter },
            { $group: { _id: '$event', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
    }
}

module.exports = new SystemLogRepo();
