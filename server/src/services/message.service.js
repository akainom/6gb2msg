const mongoose = require('mongoose');
const chatRepo = require('../repos/chat.repo');
const messageRepo = require('../repos/message.repo');
const { ApiError } = require('../mw/exception');
const es = require('../search/es.client');
const IDX_MESSAGES = process.env.ELASTIC_INDEX_MESSAGES || 'messages_v1';

function previewText(content, max = 120) {
    if (!content) return '';
    const t = String(content).trim();
    if (t.length <= max) return t;
    return `${t.slice(0, max)}…`;
}

class MessageService {
    /**
     * @param {mongoose.Types.ObjectId} chatId
     * @param {mongoose.Types.ObjectId} userId
     */
    async _requireParticipant(chatId, userId) {
        const ok = await chatRepo.isParticipant(chatId, userId);
        if (!ok) {
            throw ApiError.Forbidden('not a participant', 'ERR_CHAT_FORB', chatId);
        }

        return ok;
    }

    /**
     * @param {mongoose.Types.ObjectId} senderId
     * @param {mongoose.Types.ObjectId} chatId
     * @param {{ content?: string, attachments?: Array }} payload
     */
    async sendMessage(senderId, chatId, payload) {
        const { content, attachments = [] } = payload;
        await this._requireParticipant(chatId, senderId);

        const bag = {}
        bag.chatRepo = chatRepo;
        return await messageRepo.transactCall(async (self, bag, session) => {
            const msg = await self.createMessage(
                { chat_id: chatId, sender_id: senderId, content, attachments },
                session
            );
            await bag.chatRepo.updateLastMessage(
                chatId,
                {
                    message_id: msg._id,
                    text: previewText(msg.content),
                    sent_at: msg.createdAt ? new Date(msg.createdAt) : new Date(),
                },
                session
            );

            return msg;
        },
        bag,
        { message: 'unable to send message', code: 'ERR_MSG_SEND', val: {senderId, chatId, payload} });
    }

    /**
     * @param {mongoose.Types.ObjectId} userId
     * @param {mongoose.Types.ObjectId} chatId
     * @param {{ limit?: number, skip?: number }} [opt]
     */
    async listMessages(userId, chatId, opt = { limit: 30, skip: 0 }) {
        await this._requireParticipant(chatId, userId);
        return messageRepo.getByChat(chatId, opt);
    }

    async searchInChat(chatId, query, userId, opt = {}) {
        await this._requireParticipant(chatId, userId);

        const q = (query ?? '').trim();
        if (!q) {
            throw ApiError.BadRequest('search query is empty', 'ERR_SEARCH_Q_EMPTY');
        }

        const limit = Number(opt.limit ?? 20);
        const skip = Number(opt.skip ?? 0);

        if (limit > 100) limit = 100;
        if (skip < 0) skip = 0;

        const result = await es.search({
            index: IDX_MESSAGES,
            from: skip,
            size: limit,
            query: {
                bool: {
                    filter: [{ term: { chat_id: String(chatId) } }],
                    must: [{ match: { content: { query: q, fuzziness: 'AUTO' } } }]
                }
            },
        });

        return {
            total: result.hits?.total?.value ?? 0,
            messages: result.hits?.hits?.map(hit => ({ _id: hit._id, ...hit._source })) ?? [],
        };
    }

    /**
     * @param {mongoose.Types.ObjectId} userId
     * @param {mongoose.Types.ObjectId} messageId
     * @param {string} newContent
     */
    async editMessage(userId, messageId, newContent) {
        const ok = await messageRepo.isSender(messageId, userId);
        if (!ok) {
            throw ApiError.Forbidden('not the sender', 'ERR_MSG_FORB', messageId);
        }
        return await messageRepo.editMessage(messageId, newContent);
    }

    /**
     * @param {mongoose.Types.ObjectId} userId
     * @param {mongoose.Types.ObjectId} messageId
     */
    async deleteMessage(userId, messageId) {
        const msg = await messageRepo.getById(messageId);
        if (!msg) {
            throw ApiError.NotFound('message not found', 'ERR_MSG_NF', messageId);
        }
        await this._requireParticipant(msg.chat_id, userId);
        const sender = await messageRepo.isSender(messageId, userId);
        if (!sender) {
            throw ApiError.Forbidden('not the sender', 'ERR_MSG_FORB', messageId);
        }
        return messageRepo.deleteMessage(messageId);
    }

    /**
     * @param {mongoose.Types.ObjectId} userId
     * @param {mongoose.Types.ObjectId} chatId
     */
    async markAllRead(userId, chatId) {
        await this._requireParticipant(chatId, userId);
        return messageRepo.markAllAsRead(chatId, userId);
    }

    /**
     * @param {mongoose.Types.ObjectId} userId
     * @param {mongoose.Types.ObjectId} chatId
     */
    async unreadCount(userId, chatId) {
        await this._requireParticipant(chatId, userId);
        return messageRepo.getUnreadCount(chatId, userId);
    }

    async forwardMessage(chatId, messageId, fromId) {
        await this._requireParticipant(chatId, fromId);

        const message = await messageRepo.getById(messageId);
        await this._requireParticipant(message.chat_id, fromId);
        
        return await messageRepo.transactCall(async (self, bag, session) => {
            return await self.forwardMessage(chatId, message, fromId, session);
        },
        null,
        { message: 'unable to forward message', code: 'ERR_MSG_FORW', val: { message, fromId } });
    }
}

module.exports = new MessageService();