const mongoose = require('mongoose');
const Base = require('./base.repo');
const Message = require('../models/messages');
const { ApiError } = require('../mw/exception');
const es = require('../search/es.client');
const { mapMessage } = require('../search/es.mapper');

const IDX_MESSAGES = process.env.ELASTIC_INDEX_MESSAGES || 'messages_v1';

class MessageRepo extends Base {
    /**
     * @param {mongoose.Model} model
     */
    constructor() {
        super(Message);
    }

    /**
     * @description fetches messages by chat ID with pagination
     * @param {mongoose.ObjectId} chatId
     * @param {{ limit: number, skip: number }} [opt]
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Array>} array of message documents sorted by createdAt ascending
     */
    async getByChat(chatId, opt = { limit: 30, skip: 0 }, session = null) {
        return this.model.find({ chat_id: chatId })
            .sort({ createdAt: 1 })
            .limit(opt.limit)
            .skip(opt.skip)
            .session(session)
            .lean();
    }

    /**
     * @description creates a message and indexes it in Elasticsearch
     * @param {{ chat_id: mongoose.ObjectId, sender_id: mongoose.ObjectId, content: string, attachments: Array, reply_to?: Object }} data
     * @param {mongoose.ClientSession} [session=null]
     * @returns {Promise<Object>} created message document
     */
    async createMessage(data, session = null) {
        const { chat_id, sender_id, content, attachments = [], reply_to = null } = data;

        if (!content && attachments.length === 0) {
            throw ApiError.BadRequest('message must have content or attachments', 'ERR_MSG_EMPTY', null);
        }

        const msg = await this.create({ chat_id, sender_id, content, attachments, reply_to }, session);

        try {
            await es.index({
                index: IDX_MESSAGES,
                id: String(msg._id),
                document: mapMessage(msg)
            });
            console.log('[ES] Message indexed:', msg._id);
        } catch (e) {
            console.error('[ES] Message index error:', e.message);
        }

        return msg;
    }

    async getByIds(ids, session = null) {
        return this.model.find({ _id: { $in: ids } })
            .sort({ createdAt: -1 })
            .session(session)
            .lean();
    }

    async forwardMessage(chatId, message, fromId, session = null) {
        const msg = await this.create({
            chat_id: chatId,
            sender_id: fromId,
            content: message.content,
            attachments: message.attachments ?? [],
            is_forwarded: true,
            forwarded_by: fromId,
        }, session);

        try {
            await es.index({
                index: IDX_MESSAGES,
                id: String(msg._id),
                document: mapMessage(msg)
            });
        } catch (e) {
            console.error('[ES] Message forward index error:', e.message);
        }

        return msg;
    }

    async editMessage(messageId, newContent, session = null) {
        if (!newContent?.trim()) {
            throw ApiError.BadRequest('content cannot be empty', 'ERR_MSG_EMPTY', null);
        }

        const message = await this.model.findByIdAndUpdate(
            messageId,
            { $set: { content: newContent.trim(), is_edited: true } },
            { new: true, runValidators: true, session }
        ).lean();

        if (message) {
            try {
                await es.index({
                    index: IDX_MESSAGES,
                    id: String(messageId),
                    document: mapMessage(message)
                });
                console.log('[ES] Message edited:', messageId, '->', message.content);
            } catch (e) {
                console.error('[ES] Message edit error:', e.message);
            }
        }

        return message;
    }

    async isSender(messageId, senderId) {
        const msg = await this.model.findOne({
            _id: messageId,
            sender_id: senderId
        }).select('_id').lean();

        return !!msg;
    }

    async markAsRead(messageId) {
        return this.model.findByIdAndUpdate(
            messageId,
            { $set: { 'status.is_read': true, 'status.read_at': new Date() } },
            { new: true }
        ).lean();
    }

    async markAllAsRead(chatId, userId) {
        const result = await this.model.updateMany(
            {
                chat_id: chatId,
                sender_id: { $ne: userId },
                'status.is_read': false
            },
            { $set: { 'status.is_read': true, 'status.read_at': new Date() } }
        );

        return result.modifiedCount;
    }

    async deleteMessage(messageId, session = null) {
        const msg = await this.model.findByIdAndDelete(messageId, { session }).lean();
        
        if (msg) {
            try {
                await es.delete({
                    index: IDX_MESSAGES,
                    id: String(messageId)
                });
                console.log('[ES] Message deleted from index:', messageId);
            } catch (e) {
                if (e.meta?.statusCode !== 404) {
                    console.error('[ES] Message delete error:', e.message);
                }
            }
        }
        
        return msg;
    }

    async deleteByChatId(chatId, session = null) {
        const messages = await this.model.find({ chat_id: chatId }).select('_id').lean();
        const result = await this.model.deleteMany({ chat_id: chatId }, { session });
        
        for (const msg of messages) {
            try {
                await es.delete({
                    index: IDX_MESSAGES,
                    id: String(msg._id)
                });
            } catch (e) {
                if (e.meta?.statusCode !== 404) {
                    console.error('[ES] Message delete error:', e.message);
                }
            }
        }
        
        return result.deletedCount;
    }

    async getUnreadCount(chatId, userId) {
        return this.model.countDocuments({
            chat_id: chatId,
            sender_id: { $ne: userId },
            'status.is_read': false
        });
    }

    async toggleReaction(messageId, userId, reaction) {
        const pullResult = await this.model.updateOne(
            { _id: messageId, 'reactions.user_id': userId, 'reactions.reaction': reaction },
            { $pull: { reactions: { user_id: userId, reaction } } }
        );

        if (pullResult.modifiedCount === 0) {
            await this.model.updateOne(
                { _id: messageId },
                { $push: { reactions: { user_id: userId, reaction, created_at: new Date() } } }
            );
        }

        const updated = await this.model.findById(messageId).select('reactions').lean();
        return updated?.reactions || [];
    }
}

module.exports = new MessageRepo();
