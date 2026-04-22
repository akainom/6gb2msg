const { upload } = require('../mw/upload');
const { saveAvatar, saveMessageAttachment } = require('../mw/upload');
const path = require('path');
const ProfileService = require('../services/profile.service');
const ChatService = require('../services/chat.service');
const MessageService = require('../services/message.service');
const { ApiError } = require('../mw/exception');
const { getUserId } = require('../mw/request');

const AVATAR_BASE = process.env.PROFILE_AVATAR_DIR;
const ATTACHMENT_BASE = process.env.MESSAGE_ATTACHMENT_DIR;

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

        await ProfileService.updateProfile(userId, { avatar: relativePath });

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
            const relativePath = await saveMessageAttachment(
                file.buffer,
                chatId,
                Date.now().toString(),
                file.originalname
            );
            attachments.push({
                file_path: relativePath,
                mime_type: file.mimetype,
                original_name: file.originalname,
                size: file.size
            });
        }

        const message = await MessageService.sendMessage(userId, chatId, {
            content,
            attachments
        });

        res.json({ message });
    } catch (e) {
        next(e);
    }
}

async function getAvatar(req, res, next) {
    try {
        const { profileId } = req.params;
        
        const profile = await ProfileService.getById(profileId);
        
        if (!profile.avatar || profile.avatar === 'transparent.png') {
            return res.redirect('/default-avatar.png');
        }

        const filePath = path.join(AVATAR_BASE, profile.avatar);
        
        res.setHeader('X-Accel-Redirect', `/protected/avatars/${profile.avatar}`);
        res.setHeader('Content-Type', 'image/webp');
        res.sendFile(filePath);
    } catch (e) {
        next(e);
    }
}

async function getAttachment(req, res, next) {
    try {
        const userId = getUserId(req);
        const { chatId, filepath } = req.params;
        
        await ChatService.getForUser(userId, chatId);

        const filename = decodeURIComponent(filepath);
        const fullPath = path.join(ATTACHMENT_BASE, chatId, filepath);

        res.setHeader('X-Accel-Redirect', `/protected/attachments/${chatId}/${filename}`);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.sendFile(fullPath);
    } catch (e) {
        next(e);
    }
}

module.exports = {
    uploadAvatar,
    uploadAttachment,
    getAvatar,
    getAttachment
};
