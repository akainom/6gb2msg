const mongoose = require('mongoose');
const Base = require('./base.repo');
const Message = require('../models/messages');
const { ApiError } = require('../mw/exception');
const es = require('../search/es.client');
const { mapMessage } = require('../search/es.mapper');

const IDX_MESSAGES = process.env.ELASTIC_INDEX_MESSAGES || 'messages_v1';

class MessageRepo extends Base {
    constructor() {
        super(Message);
    }

    async getByChat(chatId, opt = { limit: 30, skip: 0 }, session = null) {
        return this.model.find({ chat_id: chatId })
            .sort({ createdAt: -1 })
            .limit(opt.limit)
            .skip(opt.skip)
            .session(session)
            .lean();
    }

    async createMessage(data, session = null) {
        const { chat_id, sender_id, content, attachments = [] } = data;

        if (!content && attachments.length === 0) {
            throw ApiError.BadRequest('message must have content or attachments', 'ERR_MSG_EMPTY', null);
        }

        const msg = await this.create({ chat_id, sender_id, content, attachments }, session);

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
}

module.exports = new MessageRepo();
