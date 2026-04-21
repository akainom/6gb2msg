const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/client.tests.env' });
const { fetchProtected } = require('./auth.tests');

const BASE_URL = process.env.BASE_URL;
const fs = require('fs');
const path = require('path');

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    if (obj !== undefined) console.log(JSON.stringify(obj, null, 2));
}

function extractFirstMessage(result) {
    return result?.data?.messages?.[0];
}

function extractLastMessage(result) {
    const messages = result?.data?.messages;
    return messages?.[messages.length - 1];
}

async function main() {
    const sessionPath = path.join(__dirname, 'ws', 'session.json');
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    
    const { accessToken, cookies } = session.user1;
    const { privateChatId, groupChatId } = session;
    
    const ts = Math.ceil(Math.random() * 10**6);
    const marker = `T${ts}`;
    const content1 = `unique ${marker} msg one`;
    const content2 = `unique ${marker} msg two`;
    const content3 = `another ${marker} msg`;

    console.log('\n========== SETUP: CREATE TEST MESSAGES ==========');
    
    const msg1 = await fetchProtected(`/chats/${privateChatId}/messages`, 'POST', 
        { content: content1 }, {}, accessToken, cookies);
    const msg1Id = msg1?.data?._id;
    log('created msg1', msg1Id);
    
    const msg2 = await fetchProtected(`/chats/${groupChatId}/messages`, 'POST',
        { content: content2 }, {}, accessToken, cookies);
    const msg2Id = msg2?.data?._id;
    log('created msg2', msg2Id);

    const msg3 = await fetchProtected(`/chats/${privateChatId}/messages`, 'POST',
        { content: content3 }, {}, accessToken, cookies);
    const msg3Id = msg3?.data?._id;
    log('created msg3', msg3Id);

    console.log('\n========== SEARCH MESSAGES: BASIC ==========');
    
    const search1 = await fetchProtected(
        `/chats/${privateChatId}/messages/search?q=unique%20${marker}`, 'GET', null, {}, accessToken, cookies);
    log('search in private (unique marker)', search1);
    
    const search2 = await fetchProtected(
        `/chats/${groupChatId}/messages/search?q=unique%20${marker}`, 'GET', null, {}, accessToken, cookies);
    log('search in group (unique marker)', search2);
    
    const searchEmpty = await fetchProtected(
        `/chats/${privateChatId}/messages/search?q=nonexistentxyz`, 'GET', null, {}, accessToken, cookies);
    log('search nonexistent', searchEmpty);

    console.log('\n========== SEARCH MESSAGES: EDIT ==========');
    
    await fetchProtected(`/chats/${privateChatId}/messages/${msg1Id}`, 'PATCH',
        { content: `UPDATED ${marker}` }, {}, accessToken, cookies);
    
    const afterEdit = await fetchProtected(
        `/chats/${privateChatId}/messages/search?q=UPDATED%20${marker}`, 'GET', null, {}, accessToken, cookies);
    log('search after edit (UPDATED marker)', afterEdit);
    
    const oldContent = await fetchProtected(
        `/chats/${privateChatId}/messages/search?q=${encodeURIComponent(content1)}`, 'GET', null, {}, accessToken, cookies);
    log('search old content should be empty', oldContent);

    console.log('\n========== SEARCH MESSAGES: DELETE ==========');
    
    await fetchProtected(`/chats/${privateChatId}/messages/${msg3Id}`, 'DELETE',
        {}, {}, accessToken, cookies);
    
    const afterDelete = await fetchProtected(
        `/chats/${privateChatId}/messages/search?q=another%20${marker}`, 'GET', null, {}, accessToken, cookies);
    log('search deleted message should be empty', afterDelete);

    console.log('\n========== SEARCH CHATS: LAST MESSAGE UPDATE ==========');
    
    const chatBeforePrivate = await fetchProtected(`/chats/${privateChatId}`, 'GET',
        null, {}, accessToken, cookies);
    log('private chat before edit last_message', chatBeforePrivate?.data?.last_message);
    
    const chatBeforeGroup = await fetchProtected(`/chats/${groupChatId}`, 'GET',
        null, {}, accessToken, cookies);
    log('group chat before edit last_message', chatBeforeGroup?.data?.last_message);

    const editGroup = await fetchProtected(`/chats/${groupChatId}/messages/${msg2Id}`, 'PATCH',
        { content: `EDITED ${marker}` }, {}, accessToken, cookies);
    log('edited group message', editGroup);

    const chatAfterEdit = await fetchProtected(`/chats/${groupChatId}`, 'GET',
        null, {}, accessToken, cookies);
    log('group chat after edit last_message should contain EDITED marker', chatAfterEdit?.data?.last_message);

    console.log('\n========== SEARCH CHATS: BASIC ==========');
    
    const searchChats1 = await fetchProtected(`/chats/search?q=Private`, 'GET', null, {}, accessToken, cookies);
    log('search Private', searchChats1);
    
    const searchChats2 = await fetchProtected(`/chats/search?q=Test%20Group`, 'GET', null, {}, accessToken, cookies);
    log('search Test Group', searchChats2);
    
    const searchChatsEmpty = await fetchProtected(`/chats/search?q=nonexistentxyz123`, 'GET', null, {}, accessToken, cookies);
    log('search nonexistent chats', searchChatsEmpty);

    console.log('\n========== ALL DONE ==========');
    process.exit(0);
}

main();