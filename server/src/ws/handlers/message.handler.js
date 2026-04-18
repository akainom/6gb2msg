const MessageService = require('../../services/message.service');

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerMessageHandlers(io, socket) {
    const userId = socket.data.userId;

    socket.on('message:send', async (payload, ack) => {
        try {
            const { chatId, content, attachments } = payload ?? {};

            if (!chatId) {
                return ack?.({ error: 'ERR_FIELDS_MISSING', message: 'chatId required' });
            }
            if (!content && (!attachments || attachments.length === 0)) {
                return ack?.({ error: 'ERR_MSG_EMPTY', message: 'content or attachments required' });
            }

            const message = await MessageService.sendMessage(userId, chatId, { content, attachments });

            io.to(`chat:${chatId}`).emit('message:new', { message });

            ack?.({ ok: true, message });
        } catch (e) {
            console.error('[WS] message:send error:', e.message);
            ack?.({ error: e.code ?? 'ERR_MSG_SEND', message: e.message });
        }
    });

    socket.on('message:edit', async (payload, ack) => {
        try {
            const { messageId, content } = payload ?? {};

            if (!messageId || !content) {
                return ack?.({ error: 'ERR_FIELDS_MISSING', message: 'messageId and content required' });
            }

            const message = await MessageService.editMessage(userId, messageId, content);

            io.to(`chat:${message.chat_id}`).emit('message:edited', { message });

            ack?.({ ok: true, message });
        } catch (e) {
            console.error('[WS] message:edit error:', e.message);
            ack?.({ error: e.code ?? 'ERR_MSG_EDIT', message: e.message });
        }
    });

    socket.on('message:delete', async (payload, ack) => {
        try {
            const { messageId } = payload ?? {};

            if (!messageId) {
                return ack?.({ error: 'ERR_FIELDS_MISSING', message: 'messageId required' });
            }

            const deleted = await MessageService.deleteMessage(userId, messageId);

            io.to(`chat:${deleted.chat_id}`).emit('message:deleted', {
                messageId: deleted._id,
                chatId: deleted.chat_id,
            });

            ack?.({ ok: true });
        } catch (e) {
            console.error('[WS] message:delete error:', e.message);
            ack?.({ error: e.code ?? 'ERR_MSG_DEL', message: e.message });
        }
    });

    socket.on('message:read', async (payload, ack) => {
        try {
            const { chatId } = payload ?? {};

            if (!chatId) {
                return ack?.({ error: 'ERR_FIELDS_MISSING', message: 'chatId required' });
            }

            const count = await MessageService.markAllRead(userId, chatId);

            socket.to(`chat:${chatId}`).emit('message:read', { chatId, userId });

            ack?.({ ok: true, marked: count });
        } catch (e) {
            console.error('[WS] message:read error:', e.message);
            ack?.({ error: e.code ?? 'ERR_MSG_READ', message: e.message });
        }
    });

    socket.on('chat:join', async (payload, ack) => {
        try {
            const { chatId } = payload ?? {};
            if (!chatId) return ack?.({ error: 'ERR_FIELDS_MISSING' });

            const isParticipant = await chatRepo.isParticipant(chatId, userId);
            if (!isParticipant) {
                return ack?.({ error: 'ERR_CHAT_FORB', message: 'not a participant' });
            }

            await socket.join(`chat:${chatId}`);
            ack?.({ ok: true });
        } catch (e) {
            ack?.({ error: e.code ?? 'ERR_CHAT_JOIN', message: e.message });
        }
    });

    socket.on('chat:leave', async (payload, ack) => {
        try {
            const { chatId } = payload ?? {};
            if (!chatId) return ack?.({ error: 'ERR_FIELDS_MISSING' });

            await socket.leave(`chat:${chatId}`);
            ack?.({ ok: true });
        } catch (e) {
            ack?.({ error: e.code ?? 'ERR_CHAT_LEAVE', message: e.message });
        }
    });
}

module.exports = registerMessageHandlers;