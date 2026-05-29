const ReportService = require('../services/report.service');
const { ApiError } = require('../mw/exception');
const { getUserId } = require('../mw/request');
const { ProfileRepo } = require('../repos/profile.repo');
const userRepo = require('../repos/user.repo');
const reportRepo = require('../repos/report.repo');
const systemLog = require('../services/systemLog.service');
const mongoose = require('mongoose');

function validId(id) {
    return id && mongoose.Types.ObjectId.isValid(String(id));
}

class ReportController {
    async create(req, res, next) {
        try {
            const userId = getUserId(req);
            const { reported_id, reason, description, message_ids } = req.body ?? {};

            if (!reported_id || !validId(reported_id)) {
                throw ApiError.BadRequest('invalid reported_id', 'ERR_FIELDS_INV', null);
            }
            if (!reason) {
                throw ApiError.BadRequest('reason required', 'ERR_FIELDS_MISSING', null);
            }

            const report = await ReportService.createReport(userId, {
                reported_id,
                reason,
                description,
                message_ids,
            });

            systemLog.write('report:create', { reported_id, reason }, userId, req.ip);

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

    async dismiss(req, res, next) {
        try {
            const adminId = getUserId(req);
            const admin = await userRepo.getById(adminId);

            if (!admin || admin.role !== 'Admin') {
                throw ApiError.Forbidden('admin only', 'ERR_ADMIN', null);
            }

            const { reportId } = req.params;
            const dismissed = await ReportService.dismissReport(adminId, reportId);

            systemLog.write('report:dismiss', { reportId }, adminId, req.ip);

            return res.status(200).json({ status: 'ok', data: dismissed });
        } catch (e) {
            next(e);
        }
    }

    async ban(req, res, next) {
        try {
            const adminId = getUserId(req);
            const { user_id, report_id, reason, unbanDate } = req.body ?? {};

            if (!user_id || !validId(user_id)) {
                throw ApiError.BadRequest('invalid user_id', 'ERR_FIELDS_INV', null);
            }

            if (String(adminId) === String(user_id)) {
                throw ApiError.BadRequest('cannot ban yourself', 'ERR_SELF', null);
            }

            const targetUser = await userRepo.model.findById(user_id).select('role').lean();
            if (targetUser?.role === 'Admin') {
                throw ApiError.Forbidden('cannot ban another admin', 'ERR_ADMIN', null);
            }

            const result = await ReportService.banUser(adminId, report_id, user_id, reason, unbanDate);

            systemLog.write('report:ban', { user_id, reason, report_id }, adminId, req.ip);

            return res.status(200).json({ status: 'ok', data: result });
        } catch (e) {
            next(e);
        }
    }

    async unban(req, res, next) {
        try {
            const adminId = getUserId(req);
            const { user_id } = req.body ?? {};

            if (!user_id || !validId(user_id)) {
                throw ApiError.BadRequest('invalid user_id', 'ERR_FIELDS_INV', null);
            }

            const result = await ReportService.unbanUser(adminId, user_id);

            return res.status(200).json({ status: 'ok', data: result });
        } catch (e) {
            next(e);
        }
    }
}

module.exports = new ReportController();
