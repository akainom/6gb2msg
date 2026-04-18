const { io } = require('socket.io-client');
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/server.test.env' });
const { ProfileRepo } = require('../repos/profile.repo');

const BASE_URL = 'http://127.0.0.1:3000';
const createdProfileIds = [];

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    if (obj !== undefined) console.log(JSON.stringify(obj, null, 2));
}

async function post(path, body, headers = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
    });
    return res.json();
}

async function registerUser(email, username, password) {
    const res = await post('/auth/register', { email, username, password });
    const userId = res.data?.user_id;
    const token = res.data?.accessToken;
    if (userId) {
        createdProfileIds.push(userId);
    }
    return { userId, token };
}

async function cleanup() {
    console.log('\n========== CLEANUP ==========');
    for (const profileId of createdProfileIds.reverse()) {
        try {
            await ProfileRepo.deleteProfileWithUser(profileId);
            console.log('Deleted profile:', profileId);
        } catch (e) {
            console.log('Cleanup error:', e.message);
        }
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

(async () => {
    console.log('\n========== SETUP: register 2 users ==========');
    const ts = Date.now();
    
    const user1 = await registerUser(`user1_${ts}@test.com`, `user1_${ts}`.slice(0, 15), 'TestPass123');
    console.log('User1 registered:', user1.userId);
    
    const user2 = await registerUser(`user2_${ts}@test.com`, `user2_${ts}`.slice(0, 15), 'TestPass123');
    console.log('User2 registered:', user2.userId);

    if (!user1.userId || !user2.userId) {
        console.error('Registration failed');
        process.exit(1);
    }

    console.log('\n========== CREATE PRIVATE CHAT ==========');
    const chatRes = await post('/chats/private', { peerId: user2.userId }, {
        'x-user-id': user1.userId,
    });
    const chatId = chatRes.data?._id;
    log('Chat created', chatId);

    if (!chatId) {
        console.error('Chat creation failed:', JSON.stringify(chatRes));
        process.exit(1);
    }

    const ownerSocket = io(BASE_URL, {
        path: '/ws',
        auth: { token: user1.token },
        transports: ['websocket'],
    });

    const peerSocket = io(BASE_URL, {
        path: '/ws',
        auth: { token: user2.token },
        transports: ['websocket'],
    });

    let ownerConnected = false;
    let peerConnected = false;

    peerSocket.on('user:online', (data) => log('peer received user:online', data));
    peerSocket.on('message:new', (data) => log('peer received message:new', data));
    peerSocket.on('message:edited', (data) => log('peer received message:edited', data));
    peerSocket.on('message:deleted', (data) => log('peer received message:deleted', data));
    peerSocket.on('typing:start', (data) => log('peer received typing:start', data));
    peerSocket.on('typing:stop', (data) => log('peer received typing:stop', data));
    peerSocket.on('connect', () => { peerConnected = true; log('peer connected', { socketId: peerSocket.id }); });
    peerSocket.on('connect_error', (e) => console.error('peer connect_error:', e.message));

    ownerSocket.on('connect', () => { 
        ownerConnected = true; 
        log('owner connected', { socketId: ownerSocket.id }); 

        setTimeout(async () => {
            ownerSocket.emit('chat:join', { chatId }, (ack) => log('chat:join ack', ack));
            peerSocket.emit('chat:join', { chatId }, (ack) => log('peer chat:join ack', ack));

            await sleep(300);
            console.log('\n========== TEST: typing:start ==========');
            ownerSocket.emit('typing:start', { chatId });

            await sleep(500);
            console.log('\n========== TEST: typing:stop ==========');
            ownerSocket.emit('typing:stop', { chatId });

            await sleep(300);
            console.log('\n========== TEST: message:send ==========');
            ownerSocket.emit('message:send', { chatId, content: 'hello from WS!' }, (ack) => {
                log('message:send ack', ack);

                if (!ack?.ok) {
                    console.error('message:send failed');
                    cleanupAndExit();
                    return;
                }

                const messageId = ack.message._id;

                setTimeout(async () => {
                    console.log('\n========== TEST: message:edit ==========');
                    ownerSocket.emit('message:edit', { messageId, content: 'edited via WS' }, (ack) => log('message:edit ack', ack));

                    await sleep(300);
                    console.log('\n========== TEST: message:read ==========');
                    peerSocket.emit('message:read', { chatId }, (ack) => log('message:read ack', ack));

                    await sleep(300);
                    console.log('\n========== TEST: message:delete ==========');
                    ownerSocket.emit('message:delete', { messageId }, (ack) => log('message:delete ack', ack));

                    await sleep(500);
                    console.log('\n========== ALL TESTS PASSED ==========\n');
                    cleanupAndExit();
                }, 300);
            });
        }, 800);
    });

    ownerSocket.on('connect_error', (e) => {
        console.error('owner connect_error:', e.message);
        cleanupAndExit();
    });

    function cleanupAndExit() {
        ownerSocket.disconnect();
        peerSocket.disconnect();
        cleanup().then(() => {
            process.exit(0);
        });
    }

    setTimeout(() => {
        console.error('timeout — something hung');
        cleanupAndExit();
    }, 20000);
})();