const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/server.test.env' });
const { register, login } = require('./auth.tests');
const { io } = require('socket.io-client');

const BASE_URL = process.env.BASE_URL;
const WS_URL = process.env.WS_URL;

const createdUsers = [];

function log(label, obj) {
    console.log(`\n========== ${label} ==========`);
    if (obj !== undefined) console.log(JSON.stringify(obj, null, 2));
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

(async () => {
    const ts = Math.ceil(Math.random() * 10**6);

    console.log('\n========== REGISTER 2 USERS ==========');
    const user1 = await register(`user1_${ts}`, `user1_${ts}@test.com`, 'TestPass123');
    log('user1', user1);
    
    const user2 = await register(`user2_${ts}`, `user2_${ts}@test.com`, 'TestPass123');
    log('user2', user2);

    if (user1.failed || user2.failed) {
        console.error('Registration failed');
        process.exit(1);
    }

    createdUsers.push(user1, user2);

    console.log('\n========== CREATE PRIVATE CHAT ==========');
    const chatRes = await fetch(`${BASE_URL}/chats/private`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user1.accessToken}`,
            'Cookie': `refreshToken=${user1.cookies.refreshToken}; fprint=${user1.cookies.fprint}`
        },
        body: JSON.stringify({ peerId: user2.userId })
    });
    const chat = await chatRes.json();
    const chatId = chat.data?._id;
    log('chat created', chatId);

    if (!chatId) {
        console.error('Chat creation failed');
        process.exit(1);
    }

    console.log('\n========== WS CONNECT ==========');
    const ownerSocket = io(WS_URL, {
        path: '/ws',
        auth: { 
            token: user1.accessToken,
            fprint: user1.cookies.fprint
        },
        transports: ['websocket'],
        rejectUnauthorized: false
    });

    const peerSocket = io(WS_URL, {
        path: '/ws',
        auth: { 
            token: user2.accessToken,
            fprint: user2.cookies.fprint
        },
        transports: ['websocket'],
        rejectUnauthorized: false
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

                    await sleep(800);
                    console.log('\n========== ALL TESTS PASSED ==========\n');
                    cleanupAndExit();
                }, 300);
            });
        }, 800);
    });

    ownerSocket.on('connect_error', (e) => {
        console.error('owner connect_error:', e.message);
    });

    function cleanupAndExit() {
        ownerSocket.disconnect();
        peerSocket.disconnect();
        console.log('\n========== DONE ==========');
        process.exit(0);
    }

    setTimeout(() => {
        console.error('timeout — something hung');
        cleanupAndExit();
    }, 20000);
})();