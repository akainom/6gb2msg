const mongoose = require('mongoose');
const Base = require('./base.repo');
const Chat = require('../models/chats');
const { ApiError } = require('../mw/exception');
const es = require('../search/es.client');
const { mapChat } = require('../search/es.mapper');

const IDX_CHATS = process.env.ELASTIC_INDEX_CHATS || 'chats_v1';

class ChatRepo extends Base {
    constructor() {
        super(Chat);
    }

    async getByUserId(userId, opt = { limit: 20, skip: 0 }) {
        return this.model.find({ 'participants.user_id': userId })
            .sort({ 'last_message.sent_at': -1, createdAt: -1 })
            .limit(opt.limit)
            .skip(opt.skip)
            .lean();
    }

    async getPrivate(userIdA, userIdB) {
        return this.model.findOne({
            type: 'private',
            'participants.user_id': { $all: [userIdA, userIdB] },
            $expr: { $eq: [{ $size: '$participants' }, 2] }
        }).lean();
    }

    async createPrivate(userIdA, userIdB, titleOverride = null, session = null) {
        const existing = await this.getPrivate(userIdA, userIdB);
        if (existing) {
            throw ApiError.BadRequest('private chat already exists', 'ERR_CHAT_EX', { userIdA, userIdB });
        }

        const chat = await this.create({
            type: 'private',
            title: titleOverride || 'Private',
            participants: [
                { user_id: userIdA, role: 'member' },
                { user_id: userIdB, role: 'member' }
            ]
        }, session);

        try {
            await es.index({
                index: IDX_CHATS,
                id: String(chat._id),
                document: mapChat(chat)
            });
            console.log('[ES] Private chat indexed:', chat._id);
        } catch (e) {
            console.error('[ES] Chat index error:', e.message);
        }

        return chat;
    }

    async createGroup(ownerId, title, memberIds = [], avatar = null, session = null) {
        if (!title?.trim()) {
            throw ApiError.BadRequest('group title required', 'ERR_CHAT_TITLE', null);
        }

        const participants = [
            { user_id: ownerId, role: 'owner' },
            ...memberIds.map(id => ({ user_id: id, role: 'member' }))
        ];

        const chat = await this.create({ type: 'group', title: title.trim(), avatar, participants }, session);

        try {
            await es.index({
                index: IDX_CHATS,
                id: String(chat._id),
                document: mapChat(chat)
            });
            console.log('[ES] Group chat indexed:', chat._id, chat.title);
        } catch (e) {
            console.error('[ES] Chat index error:', e.message);
        }

        return chat;
    }

    async isParticipant(chatId, userId) {
        const chat = await this.model.findOne({
            _id: chatId,
            'participants.user_id': userId
        }).select('_id').lean();

        return !!chat;
    }

    async getRole(chatId, userId) {
        const chat = await this.model.findOne({
            _id: chatId,
            'participants.user_id': userId
        }).select('participants').lean();

        if (!chat) return null;
        const p = chat.participants.find(p => p.user_id.toString() === userId.toString());
        return p ? p.role : null;
    }

    async addMember(chatId, userId, session = null) {
        const alreadyIn = await this.isParticipant(chatId, userId);
        if (alreadyIn) {
            throw ApiError.BadRequest('user already in chat', 'ERR_CHAT_MEMBER_EX', { chatId, userId });
        }

        return this.model.findByIdAndUpdate(
            chatId,
            { $push: { participants: { user_id: userId, role: 'member' } } },
            { new: true, session }
        ).lean();
    }

    async removeMember(chatId, userId, session = null) {
        return this.model.findByIdAndUpdate(
            chatId,
            { $pull: { participants: { user_id: userId } } },
            { new: true, session }
        ).lean();
    }

    async updateLastMessage(chatId, preview, session = null) {
        await this.model.findByIdAndUpdate(
            chatId,
            { $set: { last_message: preview } },
            { session }
        );
        
        const chat = await this.getById(chatId);
        if (chat) {
            try {
                await es.index({
                    index: IDX_CHATS,
                    id: String(chatId),
                    document: mapChat(chat)
                });
                console.log('[ES] Chat last_message updated:', chatId);
            } catch (e) {
                console.error('[ES] Chat last_message sync error:', e.message);
            }
        }
    }

    async deleteChat(chatId, session = null) {
        await this.model.findByIdAndDelete(chatId, { session });
        
        try {
            await es.delete({
                index: IDX_CHATS,
                id: String(chatId)
            });
        } catch (e) {
            if (e.meta?.statusCode !== 404) {
                console.error('[ES] Chat delete error:', e.message);
            }
        }
        
        return chatId;
    }

    async updateGroupMeta(chatId, data, session) {
        const $set = {};
        if (data.title) $set.title = data.title.trim();
        if (data.avatar) $set.avatar = data.avatar;

        return this.model.findOneAndUpdate(
            { _id: chatId, type: 'group' },
            { $set },
            { new: true, runValidators: true, session: session }
        ).lean();
    }
}

module.exports = new ChatRepo();
