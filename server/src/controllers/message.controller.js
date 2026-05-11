const MessageService = require('../services/message.service');
const messageRepo = require('../repos/message.repo');
const { ApiError } = require('../mw/exception');
const { getUserId } = require('../mw/request');
const systemLog = require('../services/systemLog.service');

class MessageController {

    /**
     * GET /chats/:chatId/messages/search?q=...&limit=...&skip=...
     */
    async searchInChat(req, res, next) {
        try {
            const userId = getUserId(req);
            const { chatId } = req.params;
            const { q } = req.query;
            const limit = parseInt(req.query.limit) || 20;
            const skip = parseInt(req.query.skip) || 0;

            const result = await MessageService.searchInChat(chatId, q, userId, { limit, skip });

            return res.status(200).json({ status: 'ok', data: result });
        } catch (e) {
            next(e);
        }
    }

    /**
     * GET /chats/:chatId/messages
     * query: limit, skip
     */
    async list(req, res, next) {
        try {
            const userId = getUserId(req);
            const { chatId } = req.params;
            const limit = parseInt(req.query.limit) || 30;
            const skip = parseInt(req.query.skip) || 0;

            const messages = await MessageService.listMessages(userId, chatId, { limit, skip });

            return res.status(200).json({ status: 'ok', data: messages });
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /chats/:chatId/messages
     * body: { content?, attachments? }
     */
    async send(req, res, next) {
        try {
            const userId = getUserId(req);
            const { chatId } = req.params;
            const { content, attachments } = req.body ?? {}

            if (!content && (!attachments || attachments.length === 0)) {
                throw ApiError.BadRequest('content or attachments required', 'ERR_MSG_EMPTY', null);
            }

            const message = await MessageService.sendMessage(userId, chatId, { content, attachments });

            const io = req.app.get('io');
            if (io) {
                const room = `chat:${chatId}`;
                const sockets = await io.in(room).fetchSockets();
                for (const socket of sockets) {
                    if (String(socket.data?.userId) !== String(userId)) {
                        socket.emit('message:new', { message });
                    }
                }
            }

            return res.status(201).json({ status: 'ok', data: message });
        } catch (e) {
            next(e);
        }
    }

    /**
     * PATCH /chats/:chatId/messages/:messageId
     * body: { content }
     */
    async edit(req, res, next) {
        try {
            const userId = getUserId(req);
            const { messageId } = req.params;
            const { content } = req.body ?? {}

            if (!content) {
                throw ApiError.BadRequest('content required', 'ERR_FIELDS_MISSING', null);
            }

            const message = await MessageService.editMessage(userId, messageId, content);

            return res.status(200).json({ status: 'ok', data: message });
        } catch (e) {
            next(e);
        }
    }

    /**
     * DELETE /chats/:chatId/messages/:messageId
     */
    async delete(req, res, next) {
        try {
            const userId = getUserId(req);
            const { messageId } = req.params;

            const message = await MessageService.deleteMessage(userId, messageId);

            return res.status(200).json({ status: 'ok', data: message });
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /chats/:chatId/messages/:messageId/forward
     * body: { targetChatId }
     */
    async forward(req, res, next) {
        try {
            const userId = getUserId(req);
            const { messageId } = req.params;
            const { targetChatId } = req.body ?? {}

            if (!targetChatId) {
                throw ApiError.BadRequest('targetChatId required', 'ERR_FIELDS_MISSING', null);
            }

            const message = await MessageService.forwardMessage(targetChatId, messageId, userId);

            const io = req.app.get('io');
            if (io) {
                io.to(`chat:${targetChatId}`).emit('message:new', { message });
            }

            return res.status(201).json({ status: 'ok', data: message });
        } catch (e) {
            next(e);
        }
    }

    async forwardBatch(req, res, next) {
        try {
            const userId = getUserId(req);
            const { chatId } = req.params;
            const { messageIds, targetChatId } = req.body ?? {}

            if (!targetChatId || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
                throw ApiError.BadRequest('targetChatId and messageIds[] required', 'ERR_FIELDS_MISSING', null);
            }

            const messages = await MessageService.forwardMessages(targetChatId, messageIds, userId);

            const io = req.app.get('io');
            if (io) {
                const room = `chat:${targetChatId}`;
                const sockets = await io.in(room).fetchSockets();
                for (const socket of sockets) {
                    if (String(socket.data?.userId) !== String(userId)) {
                        for (const msg of messages) {
                            socket.emit('message:new', { message: msg });
                        }
                    }
                }
            }

            return res.status(201).json({ status: 'ok', data: messages });
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /chats/:chatId/messages/read
     * marks all unread messages in chat as read
     */
    async markAllRead(req, res, next) {
        try {
            const userId = getUserId(req);
            const { chatId } = req.params;

            const count = await MessageService.markAllRead(userId, chatId);

            return res.status(200).json({ status: 'ok', data: { marked: count } });
        } catch (e) {
            next(e);
        }
    }

    /**
     * GET /chats/:chatId/messages/unread
     */
    async unreadCount(req, res, next) {
        try {
            const userId = getUserId(req);
            const { chatId } = req.params;

            const count = await MessageService.unreadCount(userId, chatId);

            return res.status(200).json({ status: 'ok', data: { unread: count } });
        } catch (e) {
            next(e);
        }
    }

    async getByIds(req, res, next) {
        try {
            const ids = String(req.query.ids ?? '').split(',').map((id) => id.trim()).filter(Boolean);
            if (ids.length === 0) {
                throw ApiError.BadRequest('ids query param required', 'ERR_FIELDS_MISSING', null);
            }
            const messages = await messageRepo.getByIds(ids);
            return res.status(200).json({ status: 'ok', data: messages });
        } catch (e) {
            next(e);
        }
    }
}

module.exports = new MessageController();
