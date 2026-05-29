const { upload, saveAvatar, saveMessageAttachment, saveChatAvatar, fixFileName } = require('../mw/upload');
const path = require('path');
const fs = require('fs');
const ProfileService = require('../services/profile.service');
const ChatService = require('../services/chat.service');
const MessageService = require('../services/message.service');
const chatRepo = require('../repos/chat.repo');
const { ApiError } = require('../mw/exception');
const { getUserId } = require('../mw/request');

const ATTACHMENT_BASE = process.env.MESSAGE_ATTACHMENT_DIR || '/uploads/attachments';
const CHAT_AVATAR_BASE = process.env.CHAT_AVATAR_DIR || '/uploads/chat-avatars';

async function uploadAvatar(req, res, next) {
    try {
        const userId = getUserId(req);
        const profile = await ProfileService.getByUserId(userId);
        
        if (!req.file) {
            throw ApiError.BadRequest('no file provided', 'ERR_NO_FILE');
        }

        const relativePath = await saveAvatar(
            req.file.buffer,
            String(profile._id),
            req.file.mimetype
        );

        const updated = await ProfileService.updateProfile(userId, { avatar: relativePath });

        const io = req.app.get('io');
        if (io) {
            const chatRepo = require('../repos/chat.repo');
            const chats = await chatRepo.getByUserId(userId, { limit: 100, skip: 0 });
            for (const chat of chats) {
                io.to(`chat:${chat._id}`).emit('user:status', {
                    userId: String(userId),
                    status: updated.status,
                    profile_id: String(updated._id),
                    username: updated.username,
                    displayName: updated.displayName,
                    updatedAt: updated.updatedAt,
                });
            }
        }

        res.json({ avatar: relativePath });
    } catch (e) {
        next(e);
    }
}

async function uploadAttachment(req, res, next) {
    try {
        const userId = getUserId(req);
        const { chatId } = req.params;
        const content = req.body.content || '';
        
        await ChatService.getForUser(userId, chatId);

        if (!req.files || req.files.length === 0) {
            throw ApiError.BadRequest('no files provided', 'ERR_NO_FILES');
        }

        const attachments = [];
        
        for (const file of req.files) {
            const originalName = fixFileName(file.originalname);
            const relativePath = await saveMessageAttachment(
                file.buffer,
                chatId,
                Date.now().toString(),
                originalName
            );
            attachments.push({
                file_path: relativePath,
                mime_type: file.mimetype,
                original_name: originalName,
                size: file.size
            });
        }

        const message = await MessageService.sendMessage(userId, chatId, {
            content,
            attachments
        });

        const io = req.app.get('io');
        if (io) {
            const { ProfileRepo } = require('../repos/profile.repo');
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
                const room = `chat:${chatId}`;
                const sockets = await io.in(room).fetchSockets();
                for (const sock of sockets) {
                    if (String(sock.data?.userId) !== String(userId)) {
                        sock.emit('chat:new', { chat: chatForPeer });
                    }
                }
            }
            io.to(`chat:${chatId}`).emit('message:new', { message });
        }

        res.json({ message });
    } catch (e) {
        next(e);
    }
}

async function getAvatar(req, res, next) {
    try {
        const { profileId } = req.params ?? '';
        
        const profile = await ProfileService.getById(profileId);
        
        if (!profile.avatar || profile.avatar === 'transparent.png') {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect fill="#1f2631" width="128" height="128"/><text fill="#7c9cff" font-size="48" font-family="Arial" text-anchor="middle" dy=".35em" x="64" y="64">${(profile.username || '?')[0].toUpperCase()}</text></svg>`;
            res.setHeader('Content-Type', 'image/svg+xml');
            res.setHeader('Cache-Control', 'no-cache');
            return res.status(200).send(Buffer.from(svg));
        }

        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('X-Accel-Redirect', `/internal/avatars/${profile.avatar}`);
        res.setHeader('Content-Type', 'image/webp');
        res.status(200).end();
    } catch (e) {
        next(e);
    }
}

async function getAttachment(req, res, next) {
    try {
        const { chatId, filepath } = req.params;
        const userId = req.headers['x-user-id'] || null;
        if (userId) {
            await ChatService.getForUser(userId, chatId);
        }

        const fullPath = path.join(ATTACHMENT_BASE, filepath);
        const downloadName = req.query.name || filepath.split('/').pop();

        res.download(fullPath, downloadName);
    } catch (e) {
        next(e);
    }
}

async function uploadChatAvatar(req, res, next) {
    try {
        const userId = getUserId(req);
        const { chatId } = req.params;

        await ChatService.getForUser(userId, chatId);
        const chat = await chatRepo.getById(chatId);
        const isOwner = chat.participants.some(p => String(p.user_id) === String(userId) && p.role === 'owner');
        if (chat.type !== 'group' || !isOwner) {
            throw ApiError.Forbidden('only group owner can change avatar', 'ERR_CHAT_ROLE');
        }

        if (!req.file) {
            throw ApiError.BadRequest('no file provided', 'ERR_NO_FILE');
        }

        const relativePath = await saveChatAvatar(req.file.buffer, chatId, req.file.mimetype);
        const updated = await ChatService.updateGroupMeta(userId, chatId, { avatar: relativePath });

        const io = req.app.get('io');
        if (io) {
            io.to(`chat:${chatId}`).emit('chat:updated', { chat: updated });
        }

        res.json({ avatar: relativePath });
    } catch (e) {
        next(e);
    }
}

async function getChatAvatar(req, res, next) {
    try {
        const { chatId } = req.params;
        const avatarPath = path.join(CHAT_AVATAR_BASE, `${chatId}/${chatId}.webp`);

        try {
            await fs.promises.access(avatarPath);
            res.setHeader('Cache-Control', 'no-cache');
            return res.sendFile(avatarPath);
        } catch {}

        const chat = await chatRepo.getById(chatId);
        const letter = (chat?.title || 'G')[0].toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect fill="#4f6ef7" width="128" height="128"/><text fill="#fff" font-size="48" font-family="Arial" text-anchor="middle" dy=".35em" x="64" y="64">${letter}</text></svg>`;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        res.status(200).send(Buffer.from(svg));
    } catch (e) {
        next(e);
    }
}

module.exports = {
    uploadAvatar,
    uploadAttachment,
    getAvatar,
    getAttachment,
    uploadChatAvatar,
    getChatAvatar,
};
