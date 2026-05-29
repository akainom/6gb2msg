const MessageService = require('../../services/message.service');
const chatRepo = require('../../repos/chat.repo');
const { ProfileRepo } = require('../../repos/profile.repo');

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerMessageHandlers(io, socket) {
    const userId = socket.data.userId;

    /**
     * @description handles message:send event
     */
    socket.on('message:send', async (payload, ack) => {
        try {
            const { chatId, content, attachments, reply_to = null } = payload ?? {};

            if (!chatId) {
                return ack?.({ error: 'ERR_FIELDS_MISSING', message: 'chatId required' });
            }
            if (!content && (!attachments || attachments.length === 0)) {
                return ack?.({ error: 'ERR_MSG_EMPTY', message: 'content or attachments required' });
            }

            const message = await MessageService.sendMessage(userId, chatId, { content, attachments, reply_to });

            const chat = await chatRepo.getById(chatId);
            if (chat) {
                const creatorProfile = await ProfileRepo.getByUserId(userId);
                const chatForPeer = {
                    ...(typeof chat.toObject === 'function' ? chat.toObject() : chat),
                    peer: creatorProfile ? {
                        user_id: String(creatorProfile.user_id),
                        profile_id: String(creatorProfile._id),
                        username: creatorProfile.username,
                        displayName: creatorProfile.displayName,
                        status: creatorProfile.status || 'offline',
                        last_online: creatorProfile.last_online,
                    } : null,
                };
                const sockets = await io.in(`chat:${chatId}`).fetchSockets();
                for (const sock of sockets) {
                    if (String(sock.data?.userId) !== String(userId)) {
                        sock.emit('chat:new', { chat: chatForPeer });
                    }
                }
            }

            io.to(`chat:${chatId}`).emit('message:new', { message });

            ack?.({ ok: true, message });
        } catch (e) {
            console.error('[WS] message:send error:', e.message);
            ack?.({ error: e.code ?? 'ERR_MSG_SEND', message: e.message });
        }
    });

    /**
     * @description handles message:edit event
     */
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

    /**
     * @description handles message:delete event
     */
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

    /**
     * @description handles message:read event
     */
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

    /**
     * @description handles chat:join event
     */
    socket.on('chat:join', async (payload, ack) => {
        try {
            const { chatId } = payload ?? {};
            if (!chatId) {
                return ack?.({ error: 'ERR_FIELDS_MISSING' });
            }

            const isParticipant = await chatRepo.isParticipant(chatId, userId);
            
            if (!isParticipant) {
                return ack?.({ error: 'ERR_CHAT_FORB', message: 'not a participant' });
            }

            const room = `chat:${chatId}`;
            await socket.join(room);
            if (socket._joinedRooms && !socket._joinedRooms.includes(room)) {
                socket._joinedRooms.push(room);
            }
            ack?.({ ok: true });
        } catch (e) {
            ack?.({ error: e.code ?? 'ERR_CHAT_JOIN', message: e.message });
        }
    });

    /**
     * @description handles chat:leave event
     */
    socket.on('chat:leave', async (payload, ack) => {
        try {
            const { chatId } = payload ?? {};
            if (!chatId) return ack?.({ error: 'ERR_FIELDS_MISSING' });

            const room = `chat:${chatId}`;
            await socket.leave(room);
            if (socket._joinedRooms) {
                socket._joinedRooms = socket._joinedRooms.filter(r => r !== room);
            }
            ack?.({ ok: true });
        } catch (e) {
            ack?.({ error: e.code ?? 'ERR_CHAT_LEAVE', message: e.message });
        }
    });

    /**
     * @description handles message:forward event
     */
    socket.on('message:forward', async (payload, ack) => {
        try {
            const { messageId, targetChatId } = payload ?? {};

            if (!messageId || !targetChatId) {
                return ack?.({ error: 'ERR_FIELDS_MISSING', message: 'messageId and targetChatId required' });
            }

            const message = await MessageService.forwardMessage(targetChatId, messageId, userId);

            const chat = await chatRepo.getById(targetChatId);
            if (chat) {
                const creatorProfile = await ProfileRepo.getByUserId(userId);
                const chatForPeer = {
                    ...(typeof chat.toObject === 'function' ? chat.toObject() : chat),
                    peer: creatorProfile ? {
                        user_id: String(creatorProfile.user_id),
                        profile_id: String(creatorProfile._id),
                        username: creatorProfile.username,
                        displayName: creatorProfile.displayName,
                        status: creatorProfile.status || 'offline',
                        last_online: creatorProfile.last_online,
                    } : null,
                };
                const sockets = await io.in(`chat:${targetChatId}`).fetchSockets();
                for (const sock of sockets) {
                    if (String(sock.data?.userId) !== String(userId)) {
                        sock.emit('chat:new', { chat: chatForPeer });
                    }
                }
            }

            io.to(`chat:${targetChatId}`).emit('message:new', { message });

            ack?.({ ok: true, message });
        } catch (e) {
            ack?.({ error: e.code ?? 'ERR_MSG_FORW', message: e.message });
        }
    });
}

module.exports = registerMessageHandlers;
