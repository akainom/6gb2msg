const mongoose = require('mongoose');
const Base = require('./base.repo');
const Report = require('../models/reports');
const { ApiError } = require('../mw/exception');

class ReportRepo extends Base {
    constructor() {
        super(Report);
    }

    async getById(id, session = null) {
        return this.model.findById(id).session(session).lean();
    }

    async createReport(data, session = null) {
        const { reporter_id, reported_id, reason, description, message_ids } = data;
        
        const report = await this.create({
            reporter_id,
            reported_id,
            reason,
            description,
            message_ids,
        }, session);

        return report;
    }

    async getByReporter(reporterId, opt = { limit: 20, skip: 0 }) {
        return this.model.find({ reporter_id: reporterId })
            .sort({ createdAt: -1 })
            .limit(opt.limit)
            .skip(opt.skip)
            .lean();
    }

    async getByReported(reportedId, opt = { limit: 20, skip: 0 }) {
        return this.model.find({ reported_id: reportedId })
            .sort({ createdAt: -1 })
            .limit(opt.limit)
            .skip(opt.skip)
            .lean();
    }

    async getPending(opt = { limit: 20, skip: 0 }) {
        return this.model.find({ status: 'pending' })
            .sort({ createdAt: 1 })
            .limit(opt.limit)
            .skip(opt.skip)
            .lean();
    }

    async addMessage(reportId, messageId, session = null) {
        return this.model.findByIdAndUpdate(
            reportId,
            { $addToSet: { message_ids: messageId } },
            { new: true, session }
        ).lean();
    }

    async updateStatus(reportId, status, session = null) {
        const validStatuses = ['pending', 'resolved', 'dismissed'];
        if (!validStatuses.includes(status)) {
            throw ApiError.BadRequest('invalid status', 'ERR_STATUS', null);
        }

        return this.model.findByIdAndUpdate(
            reportId,
            { $set: { status } },
            { new: true, session }
        ).lean();
    }

    async deleteReport(reportId, session = null) {
        return this.model.findByIdAndDelete(reportId, { session }).lean();
    }
}

module.exports = new ReportRepo();