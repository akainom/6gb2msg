const chatRepo = require('../../repos/chat.repo');

const typingUsers = new Map();

function setTyping(userId, chatId) {
    if (!typingUsers.has(userId)) {
        typingUsers.set(userId, new Set());
    }
    typingUsers.get(userId).add(chatId);
}

function clearTyping(userId, chatId) {
    typingUsers.get(userId)?.delete(chatId);
}

function clearAllTyping(userId) {
    typingUsers.delete(userId);
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerTypingHandlers(io, socket) {
    const userId = socket.data.userId;

    socket.on('typing:start', async (payload) => {
        try {
            const { chatId } = payload ?? {};
            if (!chatId) return;

            const isParticipant = await chatRepo.isParticipant(chatId, userId);
            if (!isParticipant) return;

            setTyping(userId, chatId);

            socket.to(`chat:${chatId}`).emit('typing:start', { chatId, userId });
        } catch (e) {
            console.error('[WS] typing:start error:', e.message);
        }
    });

    socket.on('typing:stop', async (payload) => {
        try {
            const { chatId } = payload ?? {};
            if (!chatId) return;

            clearTyping(userId, chatId);

            socket.to(`chat:${chatId}`).emit('typing:stop', { chatId, userId });
        } catch (e) {
            console.error('[WS] typing:stop error:', e.message);
        }
    });

    socket.on('disconnect', () => {
        const chats = typingUsers.get(userId);
        if (chats) {
            for (const chatId of chats) {
                socket.to(`chat:${chatId}`).emit('typing:stop', { chatId, userId });
            }
        }
        clearAllTyping(userId);
    });
}

module.exports = registerTypingHandlers;