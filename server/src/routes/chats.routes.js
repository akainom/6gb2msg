const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chats.controller');
const MessageController = require('../controllers/message.controller');

// GET /chats/search?q=...&limit=...&skip=...
router.get('/search', ChatController.search.bind(ChatController));

// GET /chats
router.get('/', ChatController.list.bind(ChatController));

// POST /chats/private 
router.post('/private', ChatController.createPrivate.bind(ChatController));

// POST /chats/group
router.post('/group', ChatController.createGroup.bind(ChatController));

// GET  /chats/:chatid
router.get('/:chatId', ChatController.getOne.bind(ChatController));

// PATCH /chats/:chatid
router.patch('/:chatId', ChatController.updateGroupMeta.bind(ChatController));

// DELETE /chats/:chatid
router.delete('/:chatId', ChatController.deleteChat.bind(ChatController));

// POST /chats/:chatid/members
router.post('/:chatId/members', ChatController.addMember.bind(ChatController));

// DELETE /chats/:chatid/members/userid
router.delete('/:chatId/members/:userId', ChatController.removeMember.bind(ChatController));

// NOTE: static segments (/unread, /read, /search) must come before /:messageId

// GET /chats/:chatid/messages/search?q=...
router.get('/:chatId/messages/search', MessageController.searchInChat.bind(MessageController));

// GET /chats/:chatid/messages
router.get('/:chatId/messages', MessageController.list.bind(MessageController));

// POST /chats/:chatid/messages
router.post('/:chatId/messages', MessageController.send.bind(MessageController));

// GET /chats/:chatid/messages/unread
router.get('/:chatId/messages/unread', MessageController.unreadCount.bind(MessageController));

// POST /chats/:chatid/messages/read
router.post('/:chatId/messages/read', MessageController.markAllRead.bind(MessageController));

// POST /chats/:chatid/messages/forward-batch
router.post('/:chatId/messages/forward-batch', MessageController.forwardBatch.bind(MessageController));

// PATCH /chats/:chatid/messages/:messageid
router.patch('/:chatId/messages/:messageId', MessageController.edit.bind(MessageController));

// DELETE /chats/:chatid/messages/:messageid
router.delete('/:chatId/messages/:messageId', MessageController.delete.bind(MessageController));

// POST /chats/:chatid/messages/:messageid/forward
router.post('/:chatId/messages/:messageId/forward', MessageController.forward.bind(MessageController));

module.exports = router;
