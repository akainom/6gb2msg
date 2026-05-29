const MessageService = require('../services/message.service');
const { ApiError } = require('../mw/exception');
const { getUserId } = require('../mw/request');

async function toggleReaction(req, res, next) {
    try {
        const userId = getUserId(req);
        const { chatId, messageId } = req.params;
        const { reaction } = req.body ?? {};

        if (!reaction) {
            throw ApiError.BadRequest('reaction required', 'ERR_FIELDS_MISSING');
        }

        const reactions = await MessageService.toggleReaction(userId, chatId, messageId, reaction);

        const io = req.app.get('io');
        if (io) {
            io.to(`chat:${chatId}`).emit('message:reacted', {
                messageId,
                reaction,
                userId,
                reactions,
            });
        }

        res.json({ status: 'ok', data: reactions });
    } catch (e) {
        next(e);
    }
}

module.exports = { toggleReaction };
