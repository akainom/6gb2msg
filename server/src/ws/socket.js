const { Server } = require('socket.io');
const authMiddleware = require('../mw/socket.auth');
const registerMessageHandlers = require('./handlers/message.handler');
const registerTypingHandlers = require('./handlers/typing.handler');
const ProfileService = require('../services/profile.service');
const chatRepo = require('../repos/chat.repo');

/**
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL,
            credentials: true,
        },
        path: '/ws',
    });

    io.use(authMiddleware);

    io.on('connection', async (socket) => {
        const userId = socket.data.userId;

        try {
            const chats = await chatRepo.getByUserId(userId, { limit: 100, skip: 0 });
            const roomIds = chats.map(c => `chat:${c._id}`);
            await socket.join(roomIds);

            await ProfileService.setOnlineStatus(userId, 'online');

            for (const roomId of roomIds) {
                socket.to(roomId).emit('user:online', { userId });
            }
        } catch (e) {
            console.error(`[WS] connection setup failed for ${userId}:`, e.message);
            socket.disconnect(true);
            return;
        }

        registerMessageHandlers(io, socket);
        registerTypingHandlers(io, socket);

        socket.on('disconnect', async () => {
            try {
                await ProfileService.setOnlineStatus(userId, 'offline');

                const rooms = [...socket.rooms].filter(r => r.startsWith('chat:'));
                for (const roomId of rooms) {
                    socket.to(roomId).emit('user:offline', {
                        userId,
                        last_online: new Date(),
                    });
                }
            } catch (e) {
                console.error(`[WS] disconnect cleanup failed for ${userId}:`, e.message);
            }
        });
    });

    return io;
}

module.exports = initSocket;