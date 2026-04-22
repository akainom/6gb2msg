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

async function saveAvatar(buffer, profileid, mimetype) {
    const allowedAvatarMime = [
        'image/jpeg', 'image/png',
        'image/webp', 'image/jpg'
    ];

    if (!allowedAvatarMime.includes(mimetype)) {
        throw ApiError.BadRequest(`unsupported file type`, `ERR_AVA_INV`, mimetype);
    }

    const avatarDir = process.env.PROFILE_AVATAR_DIR;
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
    const attachmentDir = process.env.MESSAGE_ATTACHMENT_DIR;
    const fullDir = path.join(attachmentDir, chatId, messageId);
    await fs.promises.mkdir(fullDir, { recursive: true });

    const filepath = path.join(fullDir, originalName);
    await fs.promises.writeFile(filepath, buffer);

    return `${chatId}/${messageId}/${originalName}`;
}

module.exports = { upload, saveAvatar, saveMessageAttachment };
