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
    '/attachment/:chatId',
    upload.array('files', 10),
    FileController.uploadAttachment
);

router.get(
    '/avatar/:profileId',
    FileController.getAvatar
);

router.get(
    '/attachment/:chatId/:filepath',
    FileController.getAttachment
);

module.exports = router;
