const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/server.test.env' });

const BASE_URL = 'http://localhost:3000';

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    console.log(JSON.stringify(obj, null, 2));
}

function extractCookie(headers, name) {
    const setCookie = headers.getSetCookie?.() ?? [];
    const found = setCookie.find(c => c.startsWith(`${name}=`));
    return found ? found.split(';')[0] : null;
}

async function request(method, path, body = null, headers = {}) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE_URL}${path}`, opts);
    const data = await res.json();
    return { status: res.status, data, headers: res.headers };
}

async function post(path, body, headers = {}) { return request('POST', path, body, headers); }
async function get(path, headers = {})         { return request('GET', path, null, headers); }
async function patch(path, body, headers = {}) { return request('PATCH', path, body, headers); }
async function del(path, headers = {})         { return request('DELETE', path, null, headers); }

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
    owner:       { userId: null, cookie: null, accessToken: null, profileId: null },
    member:      { userId: null, cookie: null, accessToken: null, profileId: null },
    outsider:    { userId: null, cookie: null, accessToken: null, profileId: null },
    privateChatId: null,
    groupChatId:   null,
    messageId:     null,
};

function authHeaders(user) {
    return {
        'Cookie': user.cookie,
        'x-user-id': user.userId,
    };
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function registerUser(prefix) {
    const s = `_${Math.floor(Math.random() * 1e6)}`;
    const userData = {
        email:    `${prefix}_${s}@example.com`,
        password: 'TestPassword123',
        username: `${prefix}_${s}`.slice(0, 15),
    };

    const res = await post('/auth/register', userData);
    if (res.status !== 201) {
        throw new Error(`register failed for ${prefix}: ${JSON.stringify(res.data)}`);
    }

    const cookie = extractCookie(res.headers, 'refreshToken');
    return {
        userId:    res.data.data.user_id,
        profileId: res.data.data.profile._id,
        cookie,
        accessToken: res.data.data.accessToken,
    };
}

async function testBootstrap() {
    console.log('\n\n========== BOOTSTRAP ==========');

    state.owner    = await registerUser('owner');
    state.member   = await registerUser('member');
    state.outsider = await registerUser('outsider');

    log('owner',    { userId: state.owner.userId,    profileId: state.owner.profileId });
    log('member',   { userId: state.member.userId,   profileId: state.member.profileId });
    log('outsider', { userId: state.outsider.userId, profileId: state.outsider.profileId });

    console.log(' bootstrap OK');
}

// ─── Private Chat ─────────────────────────────────────────────────────────────

async function testPrivateChat() {
    console.log('\n\n========== PRIVATE CHAT ==========');

    // create
    const created = await post('/chats/private', { peerId: state.member.userId }, authHeaders(state.owner));
    log('create private', created.data);
    if (created.status !== 201) throw new Error(`Expected 201, got ${created.status}`);
    state.privateChatId = created.data.data._id;

    // duplicate — must fail
    const dup = await post('/chats/private', { peerId: state.member.userId }, authHeaders(state.owner));
    log('duplicate private chat', dup.data);
    if (dup.status !== 400) throw new Error(`Expected 400 on duplicate, got ${dup.status}`);
    if (dup.data.code !== 'ERR_CHAT_EX') throw new Error(`Expected ERR_CHAT_EX, got ${dup.data.code}`);

    // chat with yourself — must fail
    const self = await post('/chats/private', { peerId: state.owner.userId }, authHeaders(state.owner));
    log('chat with yourself', self.data);
    if (self.status !== 400) throw new Error(`Expected 400 on self-chat, got ${self.status}`);

    // list — owner sees it
    const list = await get('/chats', authHeaders(state.owner));
    log('owner chat list', list.data);
    if (!list.data.data.some(c => c._id === state.privateChatId)) {
        throw new Error('private chat not in owner list');
    }

    // get single — owner OK
    const single = await get(`/chats/${state.privateChatId}`, authHeaders(state.owner));
    log('get single chat', single.data);
    if (single.status !== 200) throw new Error(`Expected 200, got ${single.status}`);

    // outsider forbidden
    const forbidden = await get(`/chats/${state.privateChatId}`, authHeaders(state.outsider));
    log('outsider get chat', forbidden.data);
    if (forbidden.status !== 403) throw new Error(`Expected 403 for outsider, got ${forbidden.status}`);

    // missing peerId
    const noPeer = await post('/chats/private', {}, authHeaders(state.owner));
    log('missing peerId', noPeer.data);
    if (noPeer.status !== 400) throw new Error(`Expected 400 on missing peerId, got ${noPeer.status}`);

    console.log(' private chat OK');
}

// ─── Group Chat ───────────────────────────────────────────────────────────────

async function testGroupChat() {
    console.log('\n\n========== GROUP CHAT ==========');

    // create
    const created = await post('/chats/group', {
        title: 'Test Group',
        memberIds: [state.member.userId],
    }, authHeaders(state.owner));
    log('create group', created.data);
    if (created.status !== 201) throw new Error(`Expected 201, got ${created.status}`);
    state.groupChatId = created.data.data._id;

    // missing title
    const noTitle = await post('/chats/group', { memberIds: [] }, authHeaders(state.owner));
    log('missing title', noTitle.data);
    if (noTitle.status !== 400) throw new Error(`Expected 400 on missing title, got ${noTitle.status}`);

    // add outsider (owner)
    const added = await post(`/chats/${state.groupChatId}/members`, { userId: state.outsider.userId }, authHeaders(state.owner));
    log('add outsider to group', added.data);
    if (added.status !== 200) throw new Error(`Expected 200, got ${added.status}`);
    if (!added.data.data.participants.some(p => p.user_id === state.outsider.userId)) {
        throw new Error('outsider not in participants after add');
    }

    // add again — must fail
    const addDup = await post(`/chats/${state.groupChatId}/members`, { userId: state.outsider.userId }, authHeaders(state.owner));
    log('add duplicate member', addDup.data);
    if (addDup.status !== 400) throw new Error(`Expected 400 on duplicate member, got ${addDup.status}`);

    // member tries to remove someone — must be forbidden
    const memberRemove = await del(`/chats/${state.groupChatId}/members/${state.outsider.userId}`, authHeaders(state.member));
    log('member remove attempt', memberRemove.data);
    if (memberRemove.status !== 403) throw new Error(`Expected 403, got ${memberRemove.status}`);

    // owner removes outsider
    const removed = await del(`/chats/${state.groupChatId}/members/${state.outsider.userId}`, authHeaders(state.owner));
    log('owner removes outsider', removed.data);
    if (removed.status !== 200) throw new Error(`Expected 200, got ${removed.status}`);
    if (removed.data.data.participants.some(p => p.user_id === state.outsider.userId)) {
        throw new Error('outsider still in participants after remove');
    }

    // update group meta (owner)
    const updated = await patch(`/chats/${state.groupChatId}`, { title: 'Updated Group' }, authHeaders(state.owner));
    log('update group meta', updated.data);
    if (updated.status !== 200) throw new Error(`Expected 200, got ${updated.status}`);
    if (updated.data.data.title !== 'Updated Group') throw new Error('title not updated');

    // member cannot update meta
    const memberUpdate = await patch(`/chats/${state.groupChatId}`, { title: 'Hacked' }, authHeaders(state.member));
    log('member update meta attempt', memberUpdate.data);
    if (memberUpdate.status !== 403) throw new Error(`Expected 403 for member update, got ${memberUpdate.status}`);

    console.log(' group chat OK');
}

// ─── Messages ─────────────────────────────────────────────────────────────────

async function testMessages() {
    console.log('\n\n========== MESSAGES ==========');

    // send
    const sent = await post(`/chats/${state.privateChatId}/messages`, {
        content: 'hello from owner',
    }, authHeaders(state.owner));
    log('send message', sent.data);
    if (sent.status !== 201) throw new Error(`Expected 201, got ${sent.status}`);
    state.messageId = sent.data.data._id;

    // empty message
    const empty = await post(`/chats/${state.privateChatId}/messages`, {}, authHeaders(state.owner));
    log('empty message', empty.data);
    if (empty.status !== 400) throw new Error(`Expected 400 on empty message, got ${empty.status}`);

    // outsider cannot send
    const outsiderSend = await post(`/chats/${state.privateChatId}/messages`, {
        content: 'intruder',
    }, authHeaders(state.outsider));
    log('outsider send attempt', outsiderSend.data);
    if (outsiderSend.status !== 403) throw new Error(`Expected 403 for outsider send, got ${outsiderSend.status}`);

    // list messages (member)
    const list = await get(`/chats/${state.privateChatId}/messages`, authHeaders(state.member));
    log('message list', list.data);
    if (list.status !== 200) throw new Error(`Expected 200, got ${list.status}`);
    if (!Array.isArray(list.data.data) || list.data.data.length < 1) {
        throw new Error('message list empty');
    }

    // outsider cannot list
    const outsiderList = await get(`/chats/${state.privateChatId}/messages`, authHeaders(state.outsider));
    log('outsider list attempt', outsiderList.data);
    if (outsiderList.status !== 403) throw new Error(`Expected 403 for outsider list, got ${outsiderList.status}`);

    // unread count
    const unread = await get(`/chats/${state.privateChatId}/messages/unread`, authHeaders(state.member));
    log('unread count', unread.data);
    if (unread.status !== 200) throw new Error(`Expected 200, got ${unread.status}`);

    // mark all read
    const marked = await post(`/chats/${state.privateChatId}/messages/read`, {}, authHeaders(state.member));
    log('mark all read', marked.data);
    if (marked.status !== 200) throw new Error(`Expected 200, got ${marked.status}`);

    // edit (owner)
    const edited = await patch(`/chats/${state.privateChatId}/messages/${state.messageId}`, {
        content: 'edited text',
    }, authHeaders(state.owner));
    log('edit message', edited.data);
    if (edited.status !== 200) throw new Error(`Expected 200, got ${edited.status}`);
    if (edited.data.data.content !== 'edited text') throw new Error('content not updated');
    if (edited.data.data.is_edited !== true) throw new Error('is_edited not set');

    // member cannot edit owner's message
    const memberEdit = await patch(`/chats/${state.privateChatId}/messages/${state.messageId}`, {
        content: 'hacked',
    }, authHeaders(state.member));
    log('member edit attempt', memberEdit.data);
    if (memberEdit.status !== 403) throw new Error(`Expected 403 for member edit, got ${memberEdit.status}`);

    // forward to group
    const forwarded = await post(`/chats/${state.privateChatId}/messages/${state.messageId}/forward`, {
        targetChatId: state.groupChatId,
    }, authHeaders(state.owner));
    log('forward message', forwarded.data);
    if (forwarded.status !== 201) throw new Error(`Expected 201, got ${forwarded.status}`);

    // delete (owner)
    const deleted = await del(`/chats/${state.privateChatId}/messages/${state.messageId}`, authHeaders(state.owner));
    log('delete message', deleted.data);
    if (deleted.status !== 200) throw new Error(`Expected 200, got ${deleted.status}`);

    console.log(' messages OK');
}

async function testDeleteChats() {
    console.log('\n\n========== DELETE CHATS ==========');

    // member cannot delete group
    const memberDel = await del(`/chats/${state.groupChatId}`, authHeaders(state.member));
    log('member delete group attempt', memberDel.data);
    if (memberDel.status !== 403) throw new Error(`Expected 403, got ${memberDel.status}`);

    // owner deletes group
    const delGroup = await del(`/chats/${state.groupChatId}`, authHeaders(state.owner));
    log('owner deletes group', delGroup.data);
    if (delGroup.status !== 200) throw new Error(`Expected 200, got ${delGroup.status}`);

    // owner deletes private
    const delPrivate = await del(`/chats/${state.privateChatId}`, authHeaders(state.owner));
    log('owner deletes private chat', delPrivate.data);
    if (delPrivate.status !== 200) throw new Error(`Expected 200, got ${delPrivate.status}`);

    // deleted chat no longer accessible
    const gone = await get(`/chats/${state.privateChatId}`, authHeaders(state.owner));
    log('access deleted chat', gone.data);
    if (gone.status !== 404) throw new Error(`Expected 404 for deleted chat, got ${gone.status}`);

    console.log(' delete chats OK');
}

async function cleanup() {
    console.log('\n\n========== CLEANUP ==========');

    const { ProfileRepo } = require('../repos/profile.repo');
    const mongoose = require('mongoose');
    const connectDB = require('../db/connect');

    await connectDB();

    for (const [name, user] of Object.entries({ owner: state.owner, member: state.member, outsider: state.outsider })) {
        if (!user.profileId) continue;
        try {
            await ProfileRepo.deleteProfileWithUser(user.profileId);
            console.log(`deleted profile ${name}: ${user.profileId}`);
        } catch (e) {
            console.warn(`cleanup failed for ${name}: ${e.message}`);
        }
    }

    await mongoose.disconnect();
}

(async () => {
    try {
        await testBootstrap();
        await testPrivateChat();
        await testGroupChat();
        await testMessages();
        await testDeleteChats();

        console.log('\n\n ALL CHAT/MESSAGE CONTROLLER TESTS PASSED \n');
    } catch (e) {
        console.error(`\n FAILED: ${e.message}`);
    } finally {
        await cleanup();
    }
})();