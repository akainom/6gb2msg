const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({
    path: __dirname + '/server.test.env'
});

const connectDB = require('../db/connect');
const { AuthService, regDTO } = require('../services/auth.service');
const ChatService = require('../services/chat.service');
const MessageService = require('../services/message.service');
const { ProfileRepo } = require('../repos/profile.repo');

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    console.log(JSON.stringify(obj, null, 2));
}

function randomSuffix() {
    return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function makeUser(prefix) {
    const s = randomSuffix();
    return {
        email: `${prefix}_${s}@example.com`,
        password: 'TestPassword123',
        username: `${prefix}_${s}`.slice(0, 20),
    };
}

const state = {
    owner: null,
    member: null,
    outsider: null,
    privateChatId: null,
    groupChatId: null,
    messageId: null,
    createdProfileIds: [],
};

async function createUser(prefix) {
    const u = makeUser(prefix);
    const dto = new regDTO(u.email, u.password, u.username, 'local');
    const result = await AuthService.registerUser(dto);

    state.createdProfileIds.push(result.profile._id);

    return {
        user_id: result.user._id,
        profile_id: result.profile._id,
        email: u.email,
        username: u.username,
    };
}

async function testBootstrapUsers() {
    console.log('\n\n========== BOOTSTRAP USERS ==========');

    state.owner = await createUser('chat_owner');
    state.member = await createUser('chat_member');
    state.outsider = await createUser('chat_outsider');

    log('owner', state.owner);
    log('member', state.member);
    log('outsider', state.outsider);

    if (!state.owner?.user_id || !state.member?.user_id || !state.outsider?.user_id) {
        throw new Error('unable to create seed users');
    }

    console.log('bootstrap users OK');
}

async function testPrivateChatFlow() {
    console.log('\n\n========== PRIVATE CHAT FLOW ==========');

    const privateChat = await ChatService.createPrivate(state.owner.user_id, state.member.user_id);
    state.privateChatId = privateChat._id;

    log('private chat created', privateChat);

    if (!state.privateChatId) throw new Error('private chat id missing');

    const ownerChats = await ChatService.listForUser(state.owner.user_id);
    if (!ownerChats.some(c => String(c._id) === String(state.privateChatId))) {
        throw new Error('private chat not found in owner chat list');
    }

    const fetched = await ChatService.getForUser(state.owner.user_id, state.privateChatId);
    if (String(fetched._id) !== String(state.privateChatId)) {
        throw new Error('owner cannot fetch own private chat');
    }

    // outsider forbidden
    let forbidden = false;
    try {
        await ChatService.getForUser(state.outsider.user_id, state.privateChatId);
    } catch (e) {
        forbidden = e.code === 'ERR_CHAT_FORB';
        log('outsider private chat fetch denied', { code: e.code, message: e.message });
    }
    if (!forbidden) throw new Error('outsider should be forbidden for private chat');

    console.log('private chat flow OK');
}

async function testGroupFlow() {
    console.log('\n\n========== GROUP FLOW ==========');

    const group = await ChatService.createGroup(
        state.owner.user_id,
        'Test Group',
        [state.member.user_id],
        null
    );
    state.groupChatId = group._id;

    log('group chat created', group);

    if (!state.groupChatId) throw new Error('group chat id missing');

    const updated1 = await ChatService.addMember(state.owner.user_id, state.groupChatId, state.outsider.user_id);
    log('owner added outsider', updated1);

    const outsiderExists = updated1.participants.some(
        p => String(p.user_id) === String(state.outsider.user_id)
    );
    if (!outsiderExists) throw new Error('outsider was not added to group');

    // non-owner cannot remove another member
    let roleDenied = false;
    try {
        await ChatService.removeMember(state.member.user_id, state.groupChatId, state.outsider.user_id);
    } catch (e) {
        roleDenied = e.code === 'ERR_CHAT_ROLE';
        log('member remove denied', { code: e.code, message: e.message });
    }
    if (!roleDenied) throw new Error('member should not remove other member');

    const updated2 = await ChatService.removeMember(state.owner.user_id, state.groupChatId, state.outsider.user_id);
    log('owner removed outsider', updated2);

    const outsiderStillThere = updated2.participants.some(
        p => String(p.user_id) === String(state.outsider.user_id)
    );
    if (outsiderStillThere) throw new Error('outsider still in group after remove');

    console.log('group flow OK');
}

async function testMessageFlow() {
    console.log('\n\n========== MESSAGE FLOW ==========');

    const sent = await MessageService.sendMessage(state.owner.user_id, state.privateChatId, {
        content: 'hello from owner',
    });
    state.messageId = sent._id;

    log('message sent', sent);

    if (!state.messageId) throw new Error('message id missing after send');

    const history = await MessageService.listMessages(state.member.user_id, state.privateChatId, {
        limit: 20,
        skip: 0,
    });
    log('history for member', history);

    if (!Array.isArray(history) || history.length < 1) {
        throw new Error('member history is empty');
    }

    // outsider cannot list messages
    let listDenied = false;
    try {
        await MessageService.listMessages(state.outsider.user_id, state.privateChatId);
    } catch (e) {
        listDenied = e.code === 'ERR_CHAT_FORB';
        log('outsider history denied', { code: e.code, message: e.message });
    }
    if (!listDenied) throw new Error('outsider should not read private history');

    const edited = await MessageService.editMessage(state.owner.user_id, state.messageId, 'edited text');
    log('message edited', edited);

    if (edited.content !== 'edited text' || edited.is_edited !== true) {
        throw new Error('message edit failed');
    }

    // non-sender cannot edit
    let editDenied = false;
    try {
        await MessageService.editMessage(state.member.user_id, state.messageId, 'hacked');
    } catch (e) {
        editDenied = e.code === 'ERR_MSG_FORB';
        log('non-sender edit denied', { code: e.code, message: e.message });
    }
    if (!editDenied) throw new Error('non-sender should not edit message');

    const marked = await MessageService.markAllRead(state.member.user_id, state.privateChatId);
    log('mark all read result', { modifiedCount: marked });

    const unread = await MessageService.unreadCount(state.member.user_id, state.privateChatId);
    log('unread count (member)', { unread });

    if (typeof unread !== 'number') throw new Error('unread count is not a number');

    
    const forwarded = await MessageService.forwardMessage(state.privateChatId, sent._id, sent.sender_id);
    if (!forwarded) {
        throw new Error('message forward failed');
    }

    const privateChatMemberVision = await ChatService.listForUser(state.member.user_id);
    if (!privateChatMemberVision) {
        throw new Error('message forward failed');
    }

    log('message forwarded', forwarded, privateChatMemberVision);


    const deleted = await MessageService.deleteMessage(state.owner.user_id, state.messageId);
    log('message deleted', deleted);

    if (!deleted || String(deleted._id) !== String(state.messageId)) {
        throw new Error('message delete failed');
    }


    console.log('message flow OK');
}

async function testDeleteChats() {
    console.log('\n\n========== DELETE CHATS ==========');

    // owner can delete private chat as participant
    const delPrivate = await ChatService.deleteChat(state.owner.user_id, state.privateChatId);
    log('private chat deleted', delPrivate);

    // owner can delete group
    const delGroup = await ChatService.deleteChat(state.owner.user_id, state.groupChatId);
    log('group chat deleted', delGroup);

    console.log('delete chats OK');
}

async function cleanup() {
    console.log('\n\n========== CLEANUP ==========');

    for (const pid of state.createdProfileIds.reverse()) {
        try {
            await ProfileRepo.deleteProfileWithUser(pid);
            console.log(`deleted profile ${pid}`);
        } catch (e) {
            console.log(`cleanup failed for profile ${pid}: ${e.message}`);
        }
    }
}

(async () => {
    try {
        await connectDB();

        await testBootstrapUsers();
        await testPrivateChatFlow();
        await testGroupFlow();
        await testMessageFlow();
        await testDeleteChats();

        console.log('\n\nALL CHAT/MESSAGE SERVICE TESTS PASSED\n');
    } catch (e) {
        console.error(`\nFAILED: ${e.message}`);
        if (e.code) {
            console.error(`code: ${e.code}, val: ${JSON.stringify(e.val)}`);
        }
    } finally {
        await cleanup();
        await mongoose.disconnect();
        console.log('disconnected');
    }
})();