const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../client.tests.env' });
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL;

const EVENTS = [];

function logEvent(event, data) {
    EVENTS.push({ event, data, time: Date.now() });
    console.log('user3: ' + event + ':', JSON.stringify(data, null, 2));
}

async function main() {
    const sessionPath = path.join(__dirname, 'session.json');
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    
    const { accessToken, cookies } = session.user3;
    const { groupChatId } = session;

    console.log('user3: connecting...');

    const socket = io(WS_URL, {
        path: '/ws',
        auth: { token: accessToken, fprint: cookies.fprint },
        transports: ['websocket'],
    });

    socket.on('connect', () => {
        console.log('user3: connected');
        socket.emit('chat:join', { chatId: groupChatId }, (ack) => logEvent('chat:join', ack));
    });

    socket.on('user:online', (data) => logEvent('user:online', data));
    socket.on('user:offline', (data) => logEvent('user:offline', data));
    socket.on('typing:start', (data) => logEvent('typing:start', data));
    socket.on('typing:stop', (data) => logEvent('typing:stop', data));
    socket.on('message:new', (data) => logEvent('message:new', data));
    socket.on('message:edited', (data) => logEvent('message:edited', data));
    socket.on('message:deleted', (data) => logEvent('message:deleted', data));
    socket.on('message:read', (data) => logEvent('message:read', data));

    socket.on('connect_error', (e) => {
        console.log('user3: connect_error:', e.message);
    });

    setTimeout(() => {
        const logPath = path.join(__dirname, 'events_user3.json');
        fs.writeFileSync(logPath, JSON.stringify(EVENTS, null, 2));
        console.log('user3: saved', EVENTS.length, 'events to', logPath);
        socket.disconnect();
        process.exit(0);
    }, 15000);
}

main();