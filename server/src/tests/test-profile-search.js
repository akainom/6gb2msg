const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/server.test.env' });

const connectDB = require('../db/connect');
const { AuthService, regDTO } = require('../services/auth.service');
const ProfileService = require('../services/profile.service');
const ChatService = require('../services/chat.service');
const MessageService = require('../services/message.service');
const { ProfileRepo } = require('../repos/profile.repo');
const { ChatRepo } = require('../repos/chat.repo');
const { initSearchIndices, refreshAllIndices } = require('../search/sync.listener');

const createdProfileIds = [];
const createdChatIds = [];

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    console.log(JSON.stringify(obj, null, 2));
}

function makeUser(username, email) {
    return new regDTO(email, 'TestPassword123', username, 'local');
}

async function registerTestProfiles() {
    console.log('\n\n========== REGISTER TEST PROFILES ==========');

    const users = [
        makeUser('alex_dev', `alex_dev@mail.test`),
        makeUser('alexander_js', `alexander_js@mail.test`),
        makeUser('alexa_ui', `alexa_ui@mail.test`),
        makeUser('john_smith', `john_smith@mail.test`),
    ];

    for (const dto of users) {
        const r = await AuthService.registerUser(dto);
        createdProfileIds.push(r.profile._id);
        console.log(`created profile: ${r.profile.username}`);
    }

    console.log('register profiles OK');
}

async function createChatsWithMessages() {
    console.log('\n\n========== CREATE CHATS AND MESSAGES ==========');

    const alex = createdProfileIds[0];
    const john = createdProfileIds[3];

    const privateChat = await ChatService.createPrivate(alex, john);
    createdChatIds.push(privateChat._id);
    console.log(`created private chat: ${privateChat._id}`);

    const groupChat = await ChatService.createGroup(alex, 'Test Chat Group', [john]);
    createdChatIds.push(groupChat._id);
    console.log(`created group chat: ${groupChat._id}`);

    await MessageService.sendMessage(alex, privateChat._id, { content: 'hello world, how are you?' });
    await MessageService.sendMessage(john, privateChat._id, { content: 'elasticsearch is cool for searching' });
    await MessageService.sendMessage(alex, privateChat._id, { content: 'bye see you later' });

    console.log('messages sent OK');

    return { privateChatId: privateChat._id, groupChatId: groupChat._id };
}

async function testProfileSearch() {
    console.log('\n\n========== PROFILE SEARCH ==========');

    const r1 = await ProfileService.search('alex', { limit: 10, skip: 0 });
    log('search "alex"', r1);

    if (!Array.isArray(r1.profiles) || r1.profiles.length < 3) {
        throw new Error(`expected >=3 profiles for 'alex', got ${r1.profiles?.length ?? 0}`);
    }

    const r2 = await ProfileService.search('john_smith', { limit: 10, skip: 0 });
    log('search "john_smith"', r2);

    const hasJohn = r2.profiles.some(p => p.username === 'john_smith');
    if (!hasJohn) {
        throw new Error(`expected 'john_smith' in results`);
    }

    const r3 = await ProfileService.search('alex', { limit: 2, skip: 0 });
    const r4 = await ProfileService.search('alex', { limit: 2, skip: 2 });

    log('search "alex" page1', r3);
    log('search "alex" page2', r4);

    if (r3.profiles.length === 0) {
        throw new Error('expected non-empty first page');
    }

    console.log('profile search test OK');
}

async function testChatSearch() {
    console.log('\n\n========== CHAT SEARCH ==========');

    const r1 = await ChatService.search('test');
    log('chat search "test"', r1);

    if (!Array.isArray(r1.chats) || r1.chats.length === 0) {
        throw new Error(`expected at least 1 chat`);
    }

    console.log('chat search test OK');
}

async function testMessageSearch(chatId) {
    console.log('\n\n========== MESSAGE SEARCH ==========');

    const alex = createdProfileIds[0];

    const r1 = await MessageService.searchInChat(chatId, 'elasticsearch', alex);
    log('message search "elasticsearch"', r1);

    if (!Array.isArray(r1.messages) || r1.messages.length === 0) {
        throw new Error(`expected at least 1 message for 'elasticsearch'`);
    }

    const r2 = await MessageService.searchInChat(chatId, 'world', alex);
    log('message search "world"', r2);

    if (!Array.isArray(r2.messages) || r2.messages.length === 0) {
        throw new Error(`expected at least 1 message for 'world'`);
    }

    console.log('message search test OK');
}

async function cleanup() {
    console.log('\n\n========== CLEANUP ==========');

    for (const chatId of createdChatIds) {
        try {
            await ChatRepo.deleteChat(chatId);
            console.log(`deleted chat ${chatId}`);
        } catch (e) {
            console.log(`cleanup failed for chat ${chatId}: ${e.message}`);
        }
    }

    for (const profileId of createdProfileIds.reverse()) {
        try {
            await ProfileRepo.deleteProfileWithUser(profileId);
            console.log(`deleted profile ${profileId}`);
        } catch (e) {
            console.log(`cleanup failed for ${profileId}: ${e.message}`);
        }
    }
}

(async () => {
    try {
        await connectDB();
        await initSearchIndices();

        await registerTestProfiles();

        const { privateChatId } = await createChatsWithMessages();

        await new Promise(r => setTimeout(r, 2000));
        await refreshAllIndices();

        await testProfileSearch();
        await testChatSearch();
        await testMessageSearch(privateChatId);

        console.log('\n\nALL TESTS PASSED\n');
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