const express = require('express');
const router = express.Router();
const FileController = require('../controllers/file.controller');
const { upload } = require('../mw/upload');

router.post(
    '/avatar',
    upload.single('avatar'),
    FileController.uploadAvatar
);

router.post(
    '/chat-avatar/:chatId',
    upload.single('avatar'),
    FileController.uploadChatAvatar
);

router.post(
    '/attachment/:chatId',
    upload.array('files', 10),
    FileController.uploadAttachment
);

router.get(
    '/avatar/:profileId',
    FileController.getAvatar
);

router.get(
    '/chat-avatar/:chatId',
    FileController.getChatAvatar
);

router.get(
    '/attachment/:chatId/:filepath',
    FileController.getAttachment
);

module.exports = router;
