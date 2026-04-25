const reportRepo = require('../repos/report.repo');
const messageRepo = require('../repos/message.repo');
const { ProfileRepo } = require('../repos/profile.repo');
const userRepo = require('../repos/user.repo');
const { ApiError } = require('../mw/exception');

const VALID_REASONS = ['spam', 'harassment', 'inappropriate_content', 'other'];

class ReportService {
    async createReport(reporterId, data) {
        const { reported_id, reason, description, message_ids } = data;

        if (!reported_id) {
            throw ApiError.BadRequest('reported_id required', 'ERR_FIELDS_MISSING', null);
        }

        if (!reason || !VALID_REASONS.includes(reason)) {
            throw ApiError.BadRequest('valid reason required', 'ERR_REASON', null);
        }

        if (reporterId.toString() === reported_id.toString()) {
            throw ApiError.BadRequest('cannot report yourself', 'ERR_SELF', null);
        }

        const reportedProfile = await ProfileRepo.getByUserId(reported_id);
        if (!reportedProfile) {
            throw ApiError.NotFound('user not found', 'ERR_USR_NF', reported_id);
        }

        if (message_ids && message_ids.length > 0) {
            for (const msgId of message_ids) {
                const msg = await messageRepo.getById(msgId);
                if (!msg) {
                    throw ApiError.NotFound('message not found', 'ERR_MSG_NF', msgId);
                }
            }
        }

        const report = await reportRepo.createReport({
            reporter_id: reporterId,
            reported_id,
            reason,
            description,
            message_ids: message_ids || [],
        });

        return report;
    }

    async getMyReports(userId, opt = { limit: 20, skip: 0 }) {
        return await reportRepo.getByReporter(userId, opt);
    }

    async deleteReport(reporterId, reportId) {
        const report = await reportRepo.getById(reportId);
        if (!report) {
            throw ApiError.NotFound('report not found', 'ERR_RPT_NF', reportId);
        }

        if (report.reporter_id.toString() !== reporterId.toString()) {
            throw ApiError.Forbidden('not your report', 'ERR_RPT_FORB', reportId);
        }

        return await reportRepo.deleteReport(reportId);
    }

    async getPendingReports(opt = { limit: 20, skip: 0 }) {
        return await reportRepo.getPending(opt);
    }

    async banUser(adminId, reportId, userIdToBan, reason, unbanDate = new Date(Date.now() + 24 * 60 * 60 * 1000)) {
        const adminProfile = await ProfileRepo.getByUserId(adminId);
        const adminUser = await userRepo.getById(adminId);
        if (!adminProfile || adminUser.role !== 'Admin') {
            throw ApiError.Forbidden('admin only', 'ERR_ADMIN', null);
        }

        const targetProfile = await ProfileRepo.getByUserId(userIdToBan);
        if (!targetProfile) {
            throw ApiError.NotFound('user not found', 'ERR_USR_NF', userIdToBan);
        }

        if (new Date() > unbanDate) {
            throw ApiError.BadRequest('wrong unban date', 'ERR_UNB_WRG', { unbanDate });
        }

        const bannedUser = await userRepo.banUser(targetProfile.user_id, reason, unbanDate);
        await reportRepo.updateStatus(reportId, 'resolved')
        return bannedUser;
    }

    async unbanUser(adminId, userIdToUnban) {
        const adminProfile = await ProfileRepo.getByUserId(adminId);
        if (!adminProfile || adminProfile.role !== 'Admin') {
            throw ApiError.Forbidden('admin only', 'ERR_ADMIN', null);
        }

        const targetProfile = await ProfileRepo.getByUserId(userIdToUnban);
        if (!targetProfile) {
            throw ApiError.NotFound('user not found', 'ERR_USR_NF', userIdToUnban);
        }

        const unbannedUser = await userRepo.unbanUser(targetProfile.user_id);
        return unbannedUser;
    }
}

module.exports = new ReportService();