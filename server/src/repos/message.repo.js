const mongoose = require('mongoose');
const Base = require('./base.repo');
const Message = require('../models/messages');
const { ApiError } = require('../mw/exception');
const es = require('../search/es.client');
const { mapMessage } = require('../search/es.mapper');

class MessageRepo extends Base {
    constructor() {
        super(Message);
    }

    /**
     * @param {mongoose.Types.ObjectId} chatId
     * @param {{ limit: number, skip: number }} opt
     * @param {mongoose.ClientSession} session
     * @returns {Promise<Array>} paginated members for chat
     */
    async getByChat(chatId, opt = { limit: 30, skip: 0 }, session = null) {
        return this.model.find({ chat_id: chatId })
            .sort({ createdAt: -1 })
            .limit(opt.limit)
            .skip(opt.skip)
            .session(session)
            .lean();
    }

    /**
     * @description creates a new message and validates content
     * @param {{ chat_id, sender_id, content?, attachments? }} data
     * @param {mongoose.ClientSession} session
     * @returns {Promise<Object>} created message
     */
    async createMessage(data, session = null) {
        const { chat_id, sender_id, content, attachments = [] } = data;

        if (!content && attachments.length === 0) {
            throw ApiError.BadRequest('message must have content or attachments', 'ERR_MSG_EMPTY', null);
        }

        const msg = await this.create({ chat_id, sender_id, content, attachments }, session);

        es.index({
            index: process.env.ELASTIC_INDEX_MESSAGES || 'messages_v1',
            id: String(msg._id),
            document: mapMessage(msg)
        }).catch(e => console.error('[ES] Message sync error:', e.message));

        return msg;
    }

    /**
     * 
     * @param {mongoose.mongo.ObjectId} chatId 
     * @param {Message} message 
     * @param {mongoose.ClientSession} session 
     * @returns {Promise<Object>} forwarded message
     */
    async forwardMessage(chatId, message, fromId, session = null) {
        const msg = await this.create({
            chat_id: chatId,
            sender_id: fromId,
            content: message.content,
            attachments: message.attachments ?? [],
            is_forwarded: true,
            forwarded_by: fromId,
        }, session);

        es.index({
            index: process.env.ELASTIC_INDEX_MESSAGES || 'messages_v1',
            id: String(msg._id),
            document: mapMessage(msg)
        }).catch(e => console.error('[ES] Message sync error:', e.message));

        return msg;
    }

    /**
     * @description edits message content (sender only)
     * @param {mongoose.Types.ObjectId} messageId
     * @param {string} newContent
     * @param {mongoose.ClientSession} session
     * @returns {Promise<Object>} updated message
     */
    async editMessage(messageId, newContent, session = null) {
        if (!newContent?.trim()) {
            throw ApiError.BadRequest('content cannot be empty', 'ERR_MSG_EMPTY', null);
        }

        return this.model.findByIdAndUpdate(
            messageId,
            { $set: { content: newContent.trim(), is_edited: true } },
            { new: true, runValidators: true, session }
        ).lean();
    }

    /**
     * @param {mongoose.Types.ObjectId} messageId
     * @param {mongoose.Types.ObjectId} senderId
     * @returns {Promise<boolean>}
     */
    async isSender(messageId, senderId) {
        const msg = await this.model.findOne({
            _id: messageId,
            sender_id: senderId
        }).select('_id').lean();

        return !!msg;
    }

    /**
     * @param {mongoose.Types.ObjectId} messageId
     * @returns {Promise<Object>} updated message
     */
    async markAsRead(messageId) {
        return this.model.findByIdAndUpdate(
            messageId,
            { $set: { 'status.is_read': true, 'status.read_at': new Date() } },
            { new: true }
        ).lean();
    }

    /**
     * @param {mongoose.Types.ObjectId} chatId
     * @param {mongoose.Types.ObjectId} userId reader
     * @returns {Promise<number>} count of messages marked as read
     */
    async markAllAsRead(chatId, userId) {
        const result = await this.model.updateMany(
            {
                chat_id: chatId,
                sender_id: { $ne: userId }, // dont mark own messages
                'status.is_read': false
            },
            { $set: { 'status.is_read': true, 'status.read_at': new Date() } }
        );

        return result.modifiedCount;
    }

    /**
     * @param {mongoose.Types.ObjectId} messageId
     * @param {mongoose.ClientSession} session
     * @returns {Promise<Object>} deleted message
     */
    async deleteMessage(messageId, session = null) {
        const msg = await this.model.findByIdAndDelete(messageId, { session }).lean();
        
        if (msg) {
            try {
                await es.delete({
                    index: process.env.ELASTIC_INDEX_MESSAGES || 'messages_v1',
                    id: String(messageId)
                });
            } catch (e) {
                if (e?.meta?.statusCode !== 404) {
                    console.error('[ES] Message delete error:', e.message);
                }
            }
        }
        
        return msg;
    }

    /**
     * @param {mongoose.Types.ObjectId} chatId
     * @param {mongoose.ClientSession} session
     * @returns {Promise<number>} deleted count
     */
    async deleteByChatId(chatId, session = null) {
        const messages = await this.model.find({ chat_id: chatId }).select('_id').lean();
        const result = await this.model.deleteMany({ chat_id: chatId }, { session });
        
        for (const msg of messages) {
            try {
                await es.delete({
                    index: process.env.ELASTIC_INDEX_MESSAGES || 'messages_v1',
                    id: String(msg._id)
                });
            } catch (e) {
                if (e?.meta?.statusCode !== 404) {
                    console.error('[ES] Message delete error:', e.message);
                }
            }
        }
        
        return result.deletedCount;
    }

    /**
     * @param {mongoose.Types.ObjectId|string} chatId
     * @param {mongoose.Types.ObjectId|string} userId
     * @returns {Promise<number>} unread message count
     */
    async getUnreadCount(chatId, userId) {
        return this.model.countDocuments({
            chat_id: chatId,
            sender_id: { $ne: userId },
            'status.is_read': false
        });
    }
}

module.exports = new MessageRepo();