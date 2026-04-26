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
    const corsOrigin = process.env.CLIENT_URL 
        ? [process.env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000']
        : ['http://localhost:5173', 'http://localhost:3000'];
    
    const io = new Server(httpServer, {
        cors: {
            origin: corsOrigin,
            credentials: true,
        },
        path: '/ws',
        allowEIO3: true,
    });
    
    io.use(authMiddleware);

    io.on('connection', async (socket) => {
        console.log('[WS] connection event, id:', socket.id, 'userId:', socket.data.userId);
        const userId = socket.data.userId;

        socket.onAny((event, ...args) => {
            console.log('[WS] event received:', event, 'from:', userId);
        });

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

        console.log('[WS] registering handlers for userId:', userId);

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