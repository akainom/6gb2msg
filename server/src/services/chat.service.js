const mongoose = require('mongoose');
const chatRepo = require('../repos/chat.repo');
const messageRepo = require('../repos/message.repo');
const { ApiError } = require('../mw/exception');
const es = require('../search/es.client');
const IDX_CHATS = process.env.ELASTIC_INDEX_CHATS || 'chats_v1';

class ChatService {
    /**
     * @param {mongoose.Types.ObjectId} userId
     * @param {{ limit?: number, skip?: number }} opt
     * @returns related chat
     */
    async listForUser(userId, opt = { limit: 20, skip: 0 }) {
        return await chatRepo.getByUserId(userId, opt);
    }

    async search(query, opt = {}) {
        const q = (query ?? '').trim();
        if (!q) {
            throw ApiError.BadRequest('search query is empty', 'ERR_SEARCH_Q_EMPTY');
        }

        const limit = Number(opt.limit ?? 20);
        const skip = Number(opt.skip ?? 0);

        if (limit > 100) limit = 100;
        if (skip < 0) skip = 0;

        const result = await es.search({
            index: IDX_CHATS,
            from: skip,
            size: limit,
            query: {
                match: { title: q }
            },
        });

        return {
            total: result.hits?.total?.value ?? 0,
            chats: result.hits?.hits?.map(hit => ({ _id: hit._id, ...hit._source })) ?? [],
        };
    }

    /**
     * @param {mongoose.Types.ObjectId} userId
     * @param {mongoose.Types.ObjectId} chatId
     * @returns created chat
     */
    async getForUser(userId, chatId) {
        const chat = await chatRepo.getById(chatId);
        if (!chat) {
            throw ApiError.NotFound('chat not found', 'ERR_CHAT_NF', chatId);
        }
        const isParticipant = await chatRepo.isParticipant(chatId, userId);
        if (!isParticipant) {
            throw ApiError.Forbidden('not a participant', 'ERR_CHAT_FORB', chatId);
        }
        return chat;
    }

    /**
     * @param {mongoose.Types.ObjectId} userId
     * @param {mongoose.Types.ObjectId} peerId
     * @returns created chat
     */
    async createPrivate(userId, peerId) {
        if (userId.toString() === peerId.toString()) {
            throw ApiError.BadRequest('cannot create chat with yourself', 'ERR_CHAT_SELF', null);
        }
        return await chatRepo.createPrivate(userId, peerId);
    }

    /**
     * @param {mongoose.Types.ObjectId} ownerId
     * @param {string} title
     * @param {mongoose.Types.ObjectId[]} [memberIds] without owner
     * @param {string} [avatar]
     * @returns created group
     */
    async createGroup(ownerId, title, memberIds = [], avatar = null) {
        const ownerStr = ownerId.toString();
        const dup = memberIds.some(id => id.toString() === ownerStr);
        if (dup) {
            throw ApiError.BadRequest('owner must not appear in memberIds', 'ERR_CHAT_MEMBERS', null);
        }

        return await chatRepo.transactCall(async (self, bag, session) => {
            const created = await self.createGroup(ownerId, title, memberIds, avatar, session);
            
            return created;
        },
        null,
        {message: 'owner or members ids invalid', code: 'ERR_GRP_CRT',
            val: { ownerId, title, memberIds }}
        );
    }

    /**
     * @param {mongoose.Types.ObjectId} actorId
     * @param {mongoose.Types.ObjectId} chatId
     * @param {mongoose.Types.ObjectId} newUserId
     * @returns updated user
     */
    async addMember(actorId, chatId, newUserId) {
        return await chatRepo.transactCall(async (self, bag, session) => {
            const chat = await chatRepo.getById(chatId, session);
            if (!chat) {
                throw ApiError.NotFound('chat not found', 'ERR_CHAT_NF', chatId);
            }
            if (chat.type !== 'group') {
                throw ApiError.BadRequest('only group chats support add member', 'ERR_CHAT_TYPE', null);
            }
            const role = await chatRepo.getRole(chatId, actorId);
            if (role !== 'owner') {
                throw ApiError.Forbidden('only owner can add members', 'ERR_CHAT_ROLE', null);
            }

            const updated = await chatRepo.addMember(chatId, newUserId, session);
            return updated;
        },
        null,
        {message: 'unable to add member', code: 'ERR_ADDMB_FAIL', val: { actorId, chatId, newUserId }});
    }

    /**
     * @description removes member from group, if actorId is owner
     * @param {mongoose.Types.ObjectId} actorId
     * @param {mongoose.Types.ObjectId} chatId
     * @param {mongoose.Types.ObjectId} targetUserId
     * @returns removed user
     */
    async removeMember(actorId, chatId, targetUserId) {
        return await chatRepo.transactCall(async (self, bag, session) => {
            const chat = await self.getById(chatId, session);
            if (!chat) {
                throw ApiError.NotFound('chat not found', 'ERR_CHAT_NF', chatId);
            }
            if (chat.type === 'private') {
                throw ApiError.BadRequest('cannot remove members from private chat', 'ERR_CHAT_TYPE', null);
            }
            const actorRole = await self.getRole(chatId, actorId);
            const selfId = actorId.toString() === targetUserId.toString();
            if (selfId) {
                if (actorRole === 'owner') {
                    throw ApiError.BadRequest('owner cannot leave; delete the group chat', 'ERR_CHAT_OWNER_LEAVE', null);
                }
            } else if (actorRole !== 'owner') {
                throw ApiError.Forbidden('only owner can remove others', 'ERR_CHAT_ROLE', null);
            }
            const removed = await chatRepo.removeMember(chatId, targetUserId, session);
            return removed;
        }, 
        null,
        {message: 'unable to remove member', code: 'ERR_MEM_RMV', val: { owner: actorId, target: targetUserId }})
    }

    /**
     * @param {mongoose.Types.ObjectId} actorId
     * @param {mongoose.Types.ObjectId} chatId
     * @param {{ title?: string, avatar?: string }} data
     * @returns updated chat
     */
    async updateGroupMeta(actorId, chatId, data) {
        return await chatRepo.transactCall(async (self, bag, session) => {
            const chat = await self.getById(chatId, session);
            if (!chat || chat.type !== 'group') {
                throw ApiError.BadRequest('chat is not a group', 'ERR_CHAT_TYPE', chatId);
            }
            const role = await self.getRole(chatId, actorId);
            if (role !== 'owner') {
                throw ApiError.Forbidden('actor is not group owner', 'ERR_CHAT_ROLE', actorId);
            }
            return await self.updateGroupMeta(chatId, data, session);
        }, 
        null,
        {message: 'unable to update group metadata', code: 'ERR_GROUP_META', val: chatId});
    }

    /**
     * Private: any participant. Group: owner only. Deletes all messages in a transaction.
     * @param {mongoose.Types.ObjectId} userId
     * @param {mongoose.Types.ObjectId} chatId
     */
    async deleteChat(userId, chatId) {
        const chat = await chatRepo.getById(chatId);
        if (!chat) {
            throw ApiError.NotFound('chat not found', 'ERR_CHAT_NF', chatId);
        }
        const isParticipant = await chatRepo.isParticipant(chatId, userId);
        if (!isParticipant) {
            throw ApiError.Forbidden('not a participant', 'ERR_CHAT_FORB', chatId);
        }
        if (chat.type === 'group') {
            const role = await chatRepo.getRole(chatId, userId);
            if (role !== 'owner') {
                throw ApiError.Forbidden('only owner can delete group', 'ERR_CHAT_ROLE', null);
            }
        }

        const bag = {};
        bag.messageRepo = messageRepo;
        return await chatRepo.transactCall(async (self, bag, session) => {
            await bag.messageRepo.deleteByChatId(chatId, session);
            return await self.deleteChat(chatId, session);
        }, bag, {message: 'unable to delete chat', code: 'ERR_CHAT_DEL', val: chatId});
    }
}

module.exports = new ChatService();