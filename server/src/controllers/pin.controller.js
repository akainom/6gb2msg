const ChatService = require('../services/chat.service');
const { ApiError } = require('../mw/exception');
const { getUserId } = require('../mw/request');

async function pinMessage(req, res, next) {
    try {
        const userId = getUserId(req);
        const { chatId } = req.params;
        const { messageId } = req.body ?? {};

        if (!messageId) {
            throw ApiError.BadRequest('messageId required', 'ERR_FIELDS_MISSING');
        }

        const result = await ChatService.pinMessage(userId, chatId, messageId);
        const pinData = result?.pinned || { message_id: messageId, text: '', pinned_by: userId, pinned_at: new Date() };

        const io = req.app.get('io');
        if (io) {
            io.to(`chat:${chatId}`).emit('chat:pinned', {
                chatId,
                pinned: {
                    message_id: String(pinData.message_id),
                    text: String(pinData.text || ''),
                    pinned_by: String(pinData.pinned_by || ''),
                    pinned_at: pinData.pinned_at || new Date(),
                },
            });
        }

        res.json({ status: 'ok' });
    } catch (e) {
        next(e);
    }
}

async function unpinMessage(req, res, next) {
    try {
        const userId = getUserId(req);
        const { chatId } = req.params;

        await ChatService.unpinMessage(userId, chatId);

        const io = req.app.get('io');
        if (io) {
            io.to(`chat:${chatId}`).emit('chat:unpinned', { chatId });
        }

        res.json({ status: 'ok' });
    } catch (e) {
        next(e);
    }
}

module.exports = { pinMessage, unpinMessage };
