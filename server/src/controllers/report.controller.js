const ReportService = require('../services/report.service');
const { ApiError } = require('../mw/exception');
const { getUserId } = require('../mw/request');
const { ProfileRepo } = require('../repos/profile.repo');
const userRepo = require('../repos/user.repo');

class ReportController {
    async create(req, res, next) {
        try {
            const userId = getUserId(req);
            const { reported_id, reason, description, message_ids } = req.body ?? {};

            const report = await ReportService.createReport(userId, {
                reported_id,
                reason,
                description,
                message_ids,
            });

            return res.status(201).json({ status: 'ok', data: report });
        } catch (e) {
            next(e);
        }
    }

    async listMy(req, res, next) {
        try {
            const userId = getUserId(req);
            const limit = parseInt(req.query.limit) || 20;
            const skip = parseInt(req.query.skip) || 0;

            const reports = await ReportService.getMyReports(userId, { limit, skip });

            return res.status(200).json({ status: 'ok', data: reports });
        } catch (e) {
            next(e);
        }
    }

    async delete(req, res, next) {
        try {
            const userId = getUserId(req);
            const { reportId } = req.params;

            await ReportService.deleteReport(userId, reportId);

            return res.status(200).json({ status: 'ok' });
        } catch (e) {
            next(e);
        }
    }

    async listPending(req, res, next) {
        try {
            const adminId = getUserId(req);
            const admin = await userRepo.getById(adminId);
            if (!admin || admin.role !== 'Admin') {
                throw ApiError.Forbidden('admin only', 'ERR_ADMIN', null);
            }

            const limit = parseInt(req.query.limit) || 20;
            const skip = parseInt(req.query.skip) || 0;

            const reports = await ReportService.getPendingReports({ limit, skip });

            return res.status(200).json({ status: 'ok', data: reports });
        } catch (e) {
            next(e);
        }
    }

    async ban(req, res, next) {
        try {
            const adminId = getUserId(req);
            const { user_id, report_id, reason, unbanDate } = req.body ?? {};

            if (!user_id) {
                throw ApiError.BadRequest('user_id required', 'ERR_FIELDS_MISSING', null);
            }

            const result = await ReportService.banUser(adminId, user_id, report_id, reason, unbanDate);

            return res.status(200).json({ status: 'ok', data: result });
        } catch (e) {
            next(e);
        }
    }

    async unban(req, res, next) {
        try {
            const adminId = getUserId(req);
            const { user_id } = req.body ?? {};

            if (!user_id) {
                throw ApiError.BadRequest('user_id required', 'ERR_FIELDS_MISSING', null);
            }

            const result = await ReportService.unbanUser(adminId, user_id);

            return res.status(200).json({ status: 'ok', data: result });
        } catch (e) {
            next(e);
        }
    }
}

module.exports = new ReportController();