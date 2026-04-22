const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../client.tests.env' });
const { fetchProtected } = require('./auth.tests');

const BASE_URL = process.env.BASE_URL;
const fs = require('fs');
const path = require('path');

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    if (obj !== undefined) console.log(JSON.stringify(obj, null, 2));
}

async function main() {
    const sessionPath = path.join(__dirname, 'ws', 'session.json');
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    
    const { accessToken, cookies } = session.user1;
    const { privateChatId, groupChatId } = session;

    console.log('\n========== CREATE TEST MESSAGES ==========');
    
    for (const text of ['hello from search test', 'searchable private message', 'another one']) {
        await fetchProtected(`/chats/${privateChatId}/messages`, 'POST', { content: text }, {}, accessToken, cookies);
    }
    
    for (const text of ['group message one', 'searchable group text', 'test message three']) {
        await fetchProtected(`/chats/${groupChatId}/messages`, 'POST', { content: text }, {}, accessToken, cookies);
    }
    
    console.log('\n========== SEARCH PROFILES ==========');
    log('user1', await fetchProtected('/profiles/search?q=user_1', 'GET', null, {}, accessToken, cookies));
    log('user2', await fetchProtected('/profiles/search?q=user_2', 'GET', null, {}, accessToken, cookies));
    log('user3', await fetchProtected('/profiles/search?q=user_3', 'GET', null, {}, accessToken, cookies));
    log('nonexistent', await fetchProtected('/profiles/search?q=nonexistent123', 'GET', null, {}, accessToken, cookies));

    console.log('\n========== SEARCH CHATS ==========');
    log('TestGroup', await fetchProtected('/chats/search?q=Test%20Group', 'GET', null, {}, accessToken, cookies));
    log('Private', await fetchProtected('/chats/search?q=Private', 'GET', null, {}, accessToken, cookies));
    log('nonexistent', await fetchProtected('/chats/search?q=nonexistentxyz', 'GET', null, {}, accessToken, cookies));

    console.log('\n========== SEARCH MESSAGES (private) ==========');
    log('hello', await fetchProtected(`/chats/${privateChatId}/messages/search?q=hello`, 'GET', null, {}, accessToken, cookies));
    log('searchable', await fetchProtected(`/chats/${privateChatId}/messages/search?q=searchable`, 'GET', null, {}, accessToken, cookies));
    log('nonexistent', await fetchProtected(`/chats/${privateChatId}/messages/search?q=nonexistent123`, 'GET', null, {}, accessToken, cookies));

    console.log('\n========== SEARCH MESSAGES (group) ==========');
    log('group', await fetchProtected(`/chats/${groupChatId}/messages/search?q=group`, 'GET', null, {}, accessToken, cookies));
    log('test', await fetchProtected(`/chats/${groupChatId}/messages/search?q=test`, 'GET', null, {}, accessToken, cookies));

    console.log('\n========== PAGINATION ==========');
    log('limit', await fetchProtected('/profiles/search?q=user&limit=1', 'GET', null, {}, accessToken, cookies));
    log('skip', await fetchProtected('/profiles/search?q=user&skip=5', 'GET', null, {}, accessToken, cookies));
    log('limit+skip', await fetchProtected(`/chats/${privateChatId}/messages/search?q=searchable&limit=1&skip=1`, 'GET', null, {}, accessToken, cookies));

    console.log('\n========== ALL DONE ==========');
    process.exit(0);
}

main();