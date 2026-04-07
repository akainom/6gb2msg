const mongoose = require('mongoose');
const Base = require('./base.repo');
const Chat = require('../models/chats');
const { ApiError } = require('../mw/exception');

class ChatRepo extends Base {
    constructor() {
        super(Chat);
    }

    /**
     * @description returns all chats where user is a participant sorted by last message time desc
     * @param {mongoose.Types.ObjectId} userId
     * @param {{ limit: number, skip: number }} opt
     * @returns {Promise<Array>}
     */
    async getByUserId(userId, opt = { limit: 20, skip: 0 }) {
        return this.model.find({ 'participants.user_id': userId })
            .sort({ 'last_message.sent_at': -1, createdAt: -1 })
            .limit(opt.limit)
            .skip(opt.skip)
            .lean();
    }

    /**
     * @description finds private chat between two users
     * @param {mongoose.Types.ObjectId} userIdA
     * @param {mongoose.Types.ObjectId} userIdB
     * @returns {Promise<Object>}
     */
    async getPrivate(userIdA, userIdB) {
        return this.model.findOne({
            type: 'private',
            'participants.user_id': { $all: [userIdA, userIdB] },
            $expr: { $eq: [{ $size: '$participants' }, 2] }
        }).lean();
    }

    /**
     * @description creates a private chat between two users.
     * @param {mongoose.Types.ObjectId} userIdA
     * @param {mongoose.Types.ObjectId} userIdB
     * @param {mongoose.ClientSession} session
     * @returns {Promise<Object>} created chat
     */
    async createPrivate(userIdA, userIdB, session = null) {
        const existing = await this.getPrivate(userIdA, userIdB);
        if (existing) {
            throw ApiError.BadRequest('private chat already exists', 'ERR_CHAT_EX', { userIdA, userIdB });
        }

        return this.create({
            type: 'private',
            participants: [
                { user_id: userIdA, role: 'member' },
                { user_id: userIdB, role: 'member' }
            ]
        }, session);
    }

    /**
     * @param {mongoose.Types.ObjectId} ownerId
     * @param {string} title
     * @param {mongoose.Types.ObjectId[]} memberIds does NOT include owner
     * @param {string} avatar
     * @param {mongoose.ClientSession} session
     * @returns {Promise<Object>} created chat
     */
    async createGroup(ownerId, title, memberIds = [], avatar = null, session = null) {
        if (!title?.trim()) {
            throw ApiError.BadRequest('group title required', 'ERR_CHAT_TITLE', null);
        }

        const participants = [
            { user_id: ownerId, role: 'owner' },
            ...memberIds.map(id => ({ user_id: id, role: 'member' }))
        ];

        return this.create({ type: 'group', title: title.trim(), avatar, participants }, session);
    }

    /**
     * @description checks if user is a participant of the chat
     * @param {mongoose.Types.ObjectId} chatId
     * @param {mongoose.Types.ObjectId} userId
     * @returns {Promise<boolean>}
     */
    async isParticipant(chatId, userId) {
        const chat = await this.model.findOne({
            _id: chatId,
            'participants.user_id': userId
        }).select('_id').lean();

        return !!chat;
    }

    /**
     * @description returns the role of a user in a chat
     * @param {mongoose.Types.ObjectId} chatId
     * @param {mongoose.Types.ObjectId} userId
     * @returns {Promise<'owner'|'member'>} null if not a participant
     */
    async getRole(chatId, userId) {
        const chat = await this.model.findOne({
            _id: chatId,
            'participants.user_id': userId
        }).select('participants').lean();

        if (!chat) return null;
        const p = chat.participants.find(p => p.user_id.toString() === userId.toString());
        return p ? p.role : null;
    }

    /**
     * @description adds a member to a group chat.
     * @param {mongoose.Types.ObjectId} chatId
     * @param {mongoose.Types.ObjectId} userId
     * @param {mongoose.ClientSession} session
     * @returns {Promise<Object>} updated chat
     */
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

    /**
     * @description removes a member from a group chat.
     * @param {mongoose.Types.ObjectId} chatId
     * @param {mongoose.Types.ObjectId} userId
     * @param {mongoose.ClientSession} session
     * @returns {Promise<Object>} updated chat
     */
    async removeMember(chatId, userId, session = null) {
        return this.model.findByIdAndUpdate(
            chatId,
            { $pull: { participants: { user_id: userId } } },
            { new: true, session }
        ).lean();
    }

    /**
     * @description updates last_message preview on the chat document.
     * @param {mongoose.Types.ObjectId|string} chatId
     * @param {{ message_id, text, sent_at }} preview
     * @param {mongoose.ClientSession} session
     * @returns {Promise<void>}
     */
    async updateLastMessage(chatId, preview, session = null) {
        await this.model.findByIdAndUpdate(
            chatId,
            { $set: { last_message: preview } },
            { session }
        );
    }

    /**
     * @description deletes a chat and returns its id.
     * @param {mongoose.Types.ObjectId|string} chatId
     * @param {mongoose.ClientSession} session
     * @returns {Promise<mongoose.Types.ObjectId>}
     */
    async deleteChat(chatId, session = null) {
        await this.model.findByIdAndDelete(chatId, { session });
        return chatId;
    }

    /**
     * @description updates group title or avatar. only group chats.
     * @param {mongoose.Types.ObjectId} chatId
     * @param {{ title?: string, avatar?: string }} data
     * @param {mongoose.ClientSession} session 
     * @returns {Promise<Object>} updated chat
     */
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