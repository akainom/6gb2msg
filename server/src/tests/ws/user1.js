const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../client.tests.env' });
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL;

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    const sessionPath = path.join(__dirname, 'session.json');
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    
    const { accessToken, cookies } = session.user1;
    const { privateChatId, groupChatId } = session;

    console.log('user1: connecting...');

    const socket = io(WS_URL, {
        path: '/ws',
        auth: { token: accessToken, fprint: cookies.fprint },
        transports: ['websocket'],
    });

    socket.on('connect', async () => {
        console.log('user1: connected');
        
        // === POSITIVE TESTS ===
        
        // 1. Join private chat
        console.log('\n--- TEST: chat:join private ---');
        socket.emit('chat:join', { chatId: privateChatId }, (ack) => {
            console.log('chat:join private ack:', ack);
        });

        await sleep(200);

        // 2. Send message in private chat
        console.log('\n--- TEST: message:send private ---');
        socket.emit('message:send', { chatId: privateChatId, content: 'private msg' }, (ack) => {
            console.log('message:send private ack:', ack);
            const messageId = ack?.message?._id;
            
            sleep(200).then(() => {
                // 3. Forward message to group
                console.log('\n--- TEST: message:forward ---');
                socket.emit('message:forward', { 
                    messageId, 
                    targetChatId: groupChatId 
                }, (ack) => {
                    console.log('message:forward ack:', ack);
                });
            });
        });

        // 4. Join group chat
        await sleep(800);
        console.log('\n--- TEST: chat:join group ---');
        socket.emit('chat:join', { chatId: groupChatId }, (ack) => {
            console.log('chat:join group ack:', ack);
        });

        await sleep(300);

        // 5. Typing in group
        console.log('\n--- TEST: typing group ---');
        socket.emit('typing:start', { chatId: groupChatId });
        await sleep(200);
        socket.emit('typing:stop', { chatId: groupChatId });

        await sleep(400);

        // 6. Send message in group
        console.log('\n--- TEST: message:send group ---');
        socket.emit('message:send', { chatId: groupChatId, content: 'group msg!' }, (ack) => {
            console.log('message:send group ack:', ack);
            const messageId = ack?.message?._id;

            // 7. Edit message
            sleep(300).then(() => {
                console.log('\n--- TEST: message:edit ---');
                socket.emit('message:edit', { messageId, content: 'edited!' }, (ack) => {
                    console.log('message:edit ack:', ack);
                });
            });

            // 8. Mark read
            sleep(600).then(() => {
                console.log('\n--- TEST: message:read ---');
                socket.emit('message:read', { chatId: groupChatId }, (ack) => {
                    console.log('message:read ack:', ack);
                });
            });

            // 9. Delete message
            sleep(900).then(() => {
                console.log('\n--- TEST: message:delete ---');
                socket.emit('message:delete', { messageId }, (ack) => {
                    console.log('message:delete ack:', ack);
                });
            });
        });

        // === NEGATIVE TESTS ===
        
        await sleep(2000);
        
        // 10. Try to join non-existent chat
        console.log('\n--- TEST: chat:join invalid ---');
        socket.emit('chat:join', { chatId: 'invalid_chat_id' }, (ack) => {
            console.log('chat:join invalid ack:', ack);
        });

        // 11. Try to send to non-existent chat
        await sleep(500);
        console.log('\n--- TEST: message:send invalid chat ---');
        socket.emit('message:send', { chatId: 'invalid_chat', content: 'test' }, (ack) => {
            console.log('message:send invalid ack:', ack);
        });

        // 12. Try to send empty message
        await sleep(500);
        console.log('\n--- TEST: message:send empty ---');
        socket.emit('message:send', { chatId: privateChatId, content: '' }, (ack) => {
            console.log('message:send empty ack:', ack);
        });

        // 13. Try to edit non-existent message
        await sleep(500);
        console.log('\n--- TEST: message:edit non-existent ---');
        socket.emit('message:edit', { messageId: 'invalid_msg_id', content: 'test' }, (ack) => {
            console.log('message:edit invalid ack:', ack);
        });

        // 14. Try to delete non-existent message
        await sleep(500);
        console.log('\n--- TEST: message:delete non-existent ---');
        socket.emit('message:delete', { messageId: 'invalid_msg_id' }, (ack) => {
            console.log('message:delete invalid ack:', ack);
        });

        // Done
        await sleep(1000);
        console.log('\n========== ALL TESTS DONE user1 ==========');
        socket.disconnect();
        process.exit(0);
    });

    socket.on('connect_error', (e) => {
        console.log('user1: connect_error:', e.message);
    });
}

main();