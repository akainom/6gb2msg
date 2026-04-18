const MessageService = require('../services/message.service');
const { ApiError } = require('../mw/exception');

class MessageController {

    /**
     * GET /chats/:chatId/messages
     * query: limit, skip
     */
    async list(req, res, next) {
        try {
            const userId = req.headers['x-user-id'];
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
            const userId = req.headers['x-user-id'];
            const { chatId } = req.params;
            const { content, attachments } = req.body ?? {}

            if (!content && (!attachments || attachments.length === 0)) {
                throw ApiError.BadRequest('content or attachments required', 'ERR_MSG_EMPTY', null);
            }

            const message = await MessageService.sendMessage(userId, chatId, { content, attachments });

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
            const userId = req.headers['x-user-id'];
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
            const userId = req.headers['x-user-id'];
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
            const userId = req.headers['x-user-id'];
            const { messageId } = req.params;
            const { targetChatId } = req.body ?? {}

            if (!targetChatId) {
                throw ApiError.BadRequest('targetChatId required', 'ERR_FIELDS_MISSING', null);
            }

            const message = await MessageService.forwardMessage(targetChatId, messageId, userId);

            return res.status(201).json({ status: 'ok', data: message });
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
            const userId = req.headers['x-user-id'];
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
            const userId = req.headers['x-user-id'];
            const { chatId } = req.params;

            const count = await MessageService.unreadCount(userId, chatId);

            return res.status(200).json({ status: 'ok', data: { unread: count } });
        } catch (e) {
            next(e);
        }
    }
}

module.exports = new MessageController();