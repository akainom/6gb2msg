const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/client.tests.env' });
const path = require('path');
const fs = require('fs');

const { register, login, fetchProtected } = require('./auth.tests');

const BASE_URL = process.env.BASE_URL;

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    console.log(JSON.stringify(obj, null, 2));
}

const state = {
    reporter: null,
    reported: null,
    admin: null,
    chatId: null,
    messages: [],
    reportId: null,
};

async function testSetup() {
    console.log('\n\n========== SETUP: CREATE USERS ==========');

    const ts = Math.ceil(Math.random() * 10**6);
    
    state.reporter = await register(`reporter${ts}`, `reporter${ts}@example.com`, 'TestPassword123');
    state.reported = await register(`reported${ts}`, `reported${ts}@example.com`, 'TestPassword123');
    
    const sessionPath = path.join(__dirname, 'ws', 'session.json');
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    const { accessToken, userId, cookies } = session.user1;

    state.admin = { accessToken, userId, cookies };


    log('reporter', state.reporter);
    log('reported', state.reported);
    log('admin', state.admin);

    console.log(' users created OK');
}

async function testCreateChatAndMessages() {
    console.log('\n\n========== CREATE CHAT AND MESSAGES ==========');

    const chatRes = await fetchProtected('/chats/private', 'POST', 
        { peerId: state.reported.userId }, {}, state.reporter.accessToken, state.reporter.cookies);
    log('private chat', chatRes);
    if (chatRes.status !== 'ok') throw new Error(`chat create failed: ${chatRes.status}`);
    state.chatId = chatRes.data._id;

    const msg1 = await fetchProtected(`/chats/${state.chatId}/messages`, 'POST',
        { content: 'Hello user!' }, {}, state.reporter.accessToken, state.reporter.cookies);
    log('message 1', msg1);
    state.messages.push(msg1.data._id);

    const msg2 = await fetchProtected(`/chats/${state.chatId}/messages`, 'POST',
        { content: 'Spam message' }, {}, state.reported.accessToken, state.reported.cookies);
    log('message 2', msg2);
    state.messages.push(msg2.data._id);

    console.log(' chat and messages OK');
}

async function testCreateReport() {
    console.log('\n\n========== CREATE REPORT ==========');

    const reportRes = await fetchProtected('/reports', 'POST', {
        reported_id: state.reported.userId,
        reason: 'spam',
        description: 'User sending spam',
        message_ids: [state.messages[1]],
    }, {}, state.reporter.accessToken, state.reporter.cookies);

    log('create report', reportRes);
    if (reportRes.status !== 'ok') throw new Error(`report create failed: ${reportRes.status}`);

    state.reportId = reportRes.data._id;
    console.log(' report created OK');
}

async function testGetMyReports() {
    console.log('\n\n========== GET MY REPORTS ==========');

    const listRes = await fetchProtected('/reports', 'GET', null, {}, state.reporter.accessToken, state.reporter.cookies);
    log('my reports', listRes);
    if (listRes.status !== 'ok') throw new Error(`get reports failed: ${listRes.status}`);
    if (listRes.data.length === 0) throw new Error('no reports found');

    console.log(' get reports OK');
}

async function testAdminPending() {
    console.log('\n\n========== ADMIN GET PENDING ==========');

    const pendingRes = await fetchProtected('/reports/pending', 'GET',
        null, {}, state.admin.accessToken, state.admin.cookies);
    log('pending reports', pendingRes);
    state.admin.report = pendingRes.data.find((report) => report.reported_id === state.reported.userId);

    console.log(' pending OK');
}

async function testAdminBan() {
    console.log('\n\n========== ADMIN GET PENDING ==========');

    const report = state.admin.report;

    const banRes = await fetchProtected('/reports/ban', 'POST',
        { user_id: report.reported_id, reason: report.reason }, null, state.admin.accessToken, state.admin.cookies);
    log('banned res', banRes);

    console.log(' ban OK, trying to log in as banned');

    const loginBannedRes = await fetchProtected('/chats/private', 'POST', 
        { peerId: state.admin.userId }, {}, state.reported.accessToken, state.reported.cookies);
    log('login banned', loginBannedRes);
    
}

async function main() {
    try {
        await testSetup();
        await testCreateChatAndMessages();
        await testCreateReport();
        await testGetMyReports();
        await testAdminPending();
        await testAdminBan();

        console.log('\n\nALL REPORT TESTS PASSED \n');
    } catch (e) {
        console.error(`\nFAILED: ${e.message}`);
    }
}

main();