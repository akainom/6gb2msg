const ChatService = require('../services/chat.service');
const { ApiError } = require('../mw/exception');

class ChatController {

    /**
     * GET /chats
     * query: limit, skip
     */
    async list(req, res, next) {
        try {
            const userId = req.headers['x-user-id'];
            const limit = parseInt(req.query.limit) || 20;
            const skip = parseInt(req.query.skip) || 0;

            const chats = await ChatService.listForUser(userId, { limit, skip });

            return res.status(200).json({ status: 'ok', data: chats });
        } catch (e) {
            next(e);
        }
    }

    /**
     * GET /chats/:chatId
     */
    async getOne(req, res, next) {
        try {
            const userId = req.headers['x-user-id'];
            const { chatId } = req.params;

            const chat = await ChatService.getForUser(userId, chatId);

            return res.status(200).json({ status: 'ok', data: chat });
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /chats/private
     * body: { peerId }
     */
    async createPrivate(req, res, next) {
        try {
            const userId = req.headers['x-user-id'];
            const { peerId } = req.body ?? {}

            if (!peerId) {
                throw ApiError.BadRequest('peerId required', 'ERR_FIELDS_MISSING', null);
            }

            const chat = await ChatService.createPrivate(userId, peerId);

            return res.status(201).json({ status: 'ok', data: chat });
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /chats/group
     * body: { title, memberIds?, avatar? }
     */
    async createGroup(req, res, next) {
        try {
            const userId = req.headers['x-user-id'];
            const { title, memberIds = [], avatar = null } = req.body ?? {}

            if (!title) {
                throw ApiError.BadRequest('title required', 'ERR_FIELDS_MISSING', null);
            }

            const chat = await ChatService.createGroup(userId, title, memberIds, avatar);

            return res.status(201).json({ status: 'ok', data: chat });
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /chats/:chatId/members
     * body: { userId }
     */
    async addMember(req, res, next) {
        try {
            const actorId = req.headers['x-user-id'];
            const { chatId } = req.params;
            const { userId } = req.body ?? {}

            if (!userId) {
                throw ApiError.BadRequest('userId required', 'ERR_FIELDS_MISSING', null);
            }

            const chat = await ChatService.addMember(actorId, chatId, userId);

            return res.status(200).json({ status: 'ok', data: chat });
        } catch (e) {
            next(e);
        }
    }

    /**
     * DELETE /chats/:chatId/members/:userId
     */
    async removeMember(req, res, next) {
        try {
            const actorId = req.headers['x-user-id'];
            const { chatId, userId } = req.params;

            const chat = await ChatService.removeMember(actorId, chatId, userId);

            return res.status(200).json({ status: 'ok', data: chat });
        } catch (e) {
            next(e);
        }
    }

    /**
     * PATCH /chats/:chatId
     * body: { title?, avatar? }
     */
    async updateGroupMeta(req, res, next) {
        try {
            const actorId = req.headers['x-user-id'];
            const { chatId } = req.params;
            const { title, avatar } = req.body ?? {}

            if (!title && !avatar) {
                throw ApiError.BadRequest('nothing to update', 'ERR_FIELDS_MISSING', null);
            }

            const chat = await ChatService.updateGroupMeta(actorId, chatId, { title, avatar });

            return res.status(200).json({ status: 'ok', data: chat });
        } catch (e) {
            next(e);
        }
    }

    /**
     * DELETE /chats/:chatId
     */
    async deleteChat(req, res, next) {
        try {
            const userId = req.headers['x-user-id'];
            const { chatId } = req.params;

            await ChatService.deleteChat(userId, chatId);

            return res.status(200).json({ status: 'ok' });
        } catch (e) {
            next(e);
        }
    }
}

module.exports = new ChatController();