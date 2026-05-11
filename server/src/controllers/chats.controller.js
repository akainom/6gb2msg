const ChatService = require('../services/chat.service');
const { ApiError } = require('../mw/exception');
const { getUserId } = require('../mw/request');
const systemLog = require('../services/systemLog.service');

class ChatController {

    /**
     * GET /chats/search?q=...&limit=...&skip=...
     */
    async search(req, res, next) {
        try {
            const { q } = req.query;
            const limit = parseInt(req.query.limit) || 20;
            const skip = parseInt(req.query.skip) || 0;

            const result = await ChatService.search(q, { limit, skip });

            return res.status(200).json({ status: 'ok', data: result });
        } catch (e) {
            next(e);
        }
    }

    /**
     * GET /chats
     * query: limit, skip
     */
    async list(req, res, next) {
        try {
            const userId = getUserId(req);
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
            const userId = getUserId(req);
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
            const userId = getUserId(req);
            const { peerId } = req.body ?? {}

            if (!peerId) {
                throw ApiError.BadRequest('peerId required', 'ERR_FIELDS_MISSING', null);
            }

            const chat = await ChatService.createPrivate(userId, peerId);

            systemLog.write('chat:create', { type: 'private', chatId: chat._id, peerId }, userId, req.ip);

            const io = req.app.get('io');
            if (io) {
                for (const [id, socket] of io.sockets.sockets) {
                    const sockUserId = socket.data?.userId;
                    if (sockUserId && String(sockUserId) !== String(userId) && String(sockUserId) === String(peerId)) {
                        socket.emit('chat:new', { chat });
                    }
                }
            }

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
            const userId = getUserId(req);
            const { title, memberIds = [], avatar = null } = req.body ?? {}

            if (!title) {
                throw ApiError.BadRequest('title required', 'ERR_FIELDS_MISSING', null);
            }

            const chat = await ChatService.createGroup(userId, title, memberIds, avatar);

            systemLog.write('chat:create', { type: 'group', chatId: chat._id, title, memberCount: memberIds.length + 1 }, userId, req.ip);

            const io = req.app.get('io');
            if (io) {
                const participantIds = new Set(chat.participants.map((p) => String(p.user_id)));
                participantIds.delete(String(userId));
                for (const [id, socket] of io.sockets.sockets) {
                    const sockUserId = socket.data?.userId;
                    if (sockUserId && participantIds.has(String(sockUserId))) {
                        socket.emit('chat:new', { chat });
                    }
                }
            }

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
            const actorId = getUserId(req);
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
            const actorId = getUserId(req);
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
            const actorId = getUserId(req);
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
            const userId = getUserId(req);
            const { chatId } = req.params;

            await ChatService.deleteChat(userId, chatId);

            systemLog.write('chat:delete', { chatId }, userId, req.ip);

            return res.status(200).json({ status: 'ok' });
        } catch (e) {
            next(e);
        }
    }
}

module.exports = new ChatController();
