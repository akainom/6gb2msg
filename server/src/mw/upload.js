const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { ApiError } = require('./exception');

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

function fixFileName(name) {
    if (!name) return name;
    if (/^[\x00-\x7F]*$/.test(name)) return name;
    try {
        const decoded = Buffer.from(name, 'latin1').toString('utf8');
        if (/[\u0400-\u04FF]/.test(decoded)) return decoded;
        if (/[^\x00-\x7F]/.test(decoded)) return decoded;
    } catch {}
    return name;
}

async function saveAvatar(buffer, profileid, mimetype) {
    const allowedAvatarMime = [
        'image/jpeg', 'image/png',
        'image/webp', 'image/jpg'
    ];

    if (!allowedAvatarMime.includes(mimetype)) {
        throw ApiError.BadRequest(`unsupported file type`, `ERR_AVA_INV`, mimetype);
    }

    const avatarDir = process.env.PROFILE_AVATAR_DIR || '/uploads/avatars';
    const profileDir = path.join(avatarDir, profileid);
    await fs.promises.mkdir(profileDir, { recursive: true });

    const filename = `${profileid}.webp`;
    const filepath = path.join(profileDir, filename);

    await sharp(buffer)
        .resize(512, 512, { fit: 'cover' })
        .webp()
        .toFile(filepath);

    return `${profileid}/${filename}`;
}

async function saveMessageAttachment(buffer, chatId, messageId, originalName) {
    const safeName = fixFileName(originalName);
    const attachmentDir = process.env.MESSAGE_ATTACHMENT_DIR || '/uploads/attachments';
    const fullDir = path.join(attachmentDir, chatId, messageId);
    await fs.promises.mkdir(fullDir, { recursive: true });

    const ext = path.extname(safeName);
    const safeStem = `${messageId}${ext}`;
    const filepath = path.join(fullDir, safeStem);
    await fs.promises.writeFile(filepath, buffer);

    return `${chatId}/${messageId}/${safeStem}`;
}

async function saveChatAvatar(buffer, chatId, mimetype) {
    const allowedAvatarMime = [
        'image/jpeg', 'image/png',
        'image/webp', 'image/jpg'
    ];

    if (!allowedAvatarMime.includes(mimetype)) {
        throw ApiError.BadRequest(`unsupported file type`, `ERR_AVA_INV`, mimetype);
    }

    const avatarDir = process.env.CHAT_AVATAR_DIR || '/uploads/chat-avatars';
    const chatDir = path.join(avatarDir, chatId);
    await fs.promises.mkdir(chatDir, { recursive: true });

    const filename = `${chatId}.webp`;
    const filepath = path.join(chatDir, filename);

    await sharp(buffer)
        .resize(512, 512, { fit: 'cover' })
        .webp()
        .toFile(filepath);

    return `${chatId}/${filename}`;
}

module.exports = { upload, saveAvatar, saveMessageAttachment, saveChatAvatar, fixFileName };
