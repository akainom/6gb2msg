const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../client.tests.env' });
const { register, login } = require('../auth.tests');

const BASE_URL = process.env.BASE_URL;
const fs = require('fs');
const path = require('path');

async function main() {
    const ts = Math.ceil(Math.random() * 10**6);

    console.log('\n========== REGISTER 3 USERS ==========');
    const user1 = await register(`user1_${ts}`, `user1_${ts}@test.com`, 'TestPass123');
    console.log('user1:', `user1_${ts}`);
    
    const user2 = await register(`user2_${ts}`, `user2_${ts}@test.com`, 'TestPass123');
    console.log('user2:', user2.userId);

    const user3 = await register(`user3_${ts}`, `user3_${ts}@test.com`, 'TestPass123');
    console.log('user3:', user3.userId);

    if (user1.failed || user2.failed || user3.failed) {
        console.error('Registration failed');
        process.exit(1);
    }

    console.log('\n========== CREATE PRIVATE CHAT (user1 <-> user2) ==========');
    const privateChatRes = await fetch(`${BASE_URL}/chats/private`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user1.accessToken}`,
            'Cookie': `refreshToken=${user1.cookies.refreshToken}; fprint=${user1.cookies.fprint}`
        },
        body: JSON.stringify({ peerId: user2.userId })
    });
    const privateChat = await privateChatRes.json();
    const privateChatId = privateChat.data?._id;
    console.log('privateChatId:', privateChatId);

    console.log('\n========== CREATE GROUP CHAT (user1, user2, user3) ==========');
    const groupChatRes = await fetch(`${BASE_URL}/chats/group`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user1.accessToken}`,
            'Cookie': `refreshToken=${user1.cookies.refreshToken}; fprint=${user1.cookies.fprint}`
        },
        body: JSON.stringify({ 
            title: 'Test Group',
            memberIds: [user2.userId, user3.userId]
        })
    });
    const groupChat = await groupChatRes.json();
    const groupChatId = groupChat.data?._id;
    console.log('groupChatId:', groupChatId);

    if (!privateChatId || !groupChatId) {
        console.error('Chat creation failed');
        process.exit(1);
    }

    const sessionData = {
        user1: { ...user1, userId: user1.userId },
        user2: { ...user2, userId: user2.userId },
        user3: { ...user3, userId: user3.userId },
        privateChatId,
        groupChatId
    };

    const filePath = path.join(__dirname, 'session.json');
    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
    console.log('\n========== SAVED TO', filePath, '==========\n');
}

main();