const { Server } = require('socket.io');
const authMiddleware = require('../mw/socket.auth');
const registerMessageHandlers = require('./handlers/message.handler');
const registerTypingHandlers = require('./handlers/typing.handler');
const ProfileService = require('../services/profile.service');
const chatRepo = require('../repos/chat.repo');

const HEARTBEAT_INTERVAL = 25000;
const HEARTBEAT_TIMEOUT = 10000;
const ACTIVE_CONNECTIONS = new Map(); // userId -> Set<socketId>

function addConnection(userId, socketId) {
    if (!ACTIVE_CONNECTIONS.has(userId)) ACTIVE_CONNECTIONS.set(userId, new Set());
    ACTIVE_CONNECTIONS.get(userId).add(socketId);
}

function removeConnection(userId, socketId) {
    const sockets = ACTIVE_CONNECTIONS.get(userId);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
        ACTIVE_CONNECTIONS.delete(userId);
        return true; // was last connection
    }
    return false;
}

function initSocket(httpServer, app) {
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
        pingInterval: HEARTBEAT_INTERVAL,
        pingTimeout: HEARTBEAT_TIMEOUT,
        connectTimeout: 10000,
        transports: ['websocket', 'polling'],
        allowUpgrades: true,
    });

    app.set('io', io);
    io.use(authMiddleware);

    io.on('connection', async (socket) => {
        const userId = socket.data.userId;
        console.log(`[WS] connected userId=${userId} socketId=${socket.id} transport=${socket.conn.transport.name}`);
        addConnection(userId, socket.id);

        socket.onAny((event, ...args) => {
            if (event !== 'message:send' && event !== 'typing:start' && event !== 'typing:stop') {
                console.log(`[WS] event userId=${userId} event=${event}`);
            }
        });

        try {
            const chats = await chatRepo.getByUserId(userId, { limit: 100, skip: 0 });
            const roomIds = chats.map(c => `chat:${c._id}`);
            await socket.join(roomIds);
            socket._joinedRooms = roomIds;

            const status = await ProfileService.setOnlineStatus(userId, 'online');

            for (const roomId of roomIds) {
                socket.to(roomId).emit('user:online', { userId, status });
            }

            const { ProfileRepo } = require('../repos/profile.repo');
            const currentProfile = await ProfileRepo.getByUserId(userId);
            if (currentProfile) {
                socket.emit('user:status', {
                    userId: String(userId),
                    status: currentProfile.status,
                    profile_id: String(currentProfile._id),
                    username: currentProfile.username,
                    displayName: currentProfile.displayName,
                    updatedAt: currentProfile.updatedAt,
                });
            }

            console.log(`[WS] joinedRooms userId=${userId} count=${roomIds.length}`);
        } catch (e) {
            console.error(`[WS] setupFailed userId=${userId} error=${e.message}`);
            socket.disconnect(true);
            return;
        }

        registerMessageHandlers(io, socket);
        registerTypingHandlers(io, socket);

        socket.on('disconnect', async (reason) => {
            console.log(`[WS] disconnected userId=${userId} reason=${reason}`);
            const wasLast = removeConnection(userId, socket.id);

            try {
                if (wasLast) {
                    await ProfileService.setOnlineStatus(userId, 'offline');
                }

                const rooms = socket._joinedRooms || [];
                for (const roomId of rooms) {
                    io.to(roomId).emit('user:offline', {
                        userId,
                        status: 'offline',
                        last_online: new Date(),
                    });
                }
            } catch (e) {
                console.error(`[WS] disconnectCleanupFailed userId=${userId} error=${e.message}`);
            }
        });
    });

    io.engine.on('connection_error', (err) => {
        console.error(`[WS] connectionError code=${err.code} message=${err.message}`);
    });

    return io;
}

function getActiveCount() {
    return ACTIVE_CONNECTIONS.size;
}

module.exports = initSocket;
module.exports.getActiveCount = getActiveCount;
