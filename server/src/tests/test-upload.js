const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/server.test.env' });

const fs = require('fs');
const path = require('path');
const connectDB = require('../db/connect');
const { AuthService, regDTO } = require('../services/auth.service');
const ProfileService = require('../services/profile.service');
const { saveAvatar } = require('../mw/upload');

async function test() {
    await connectDB();

    const user = new regDTO('test@test.com', 'TestPass123', 'test_user_upload', 'local');
    const { profile, user: createdUser } = await AuthService.registerUser(user);
    console.log('Created user:', createdUser._id, 'Profile:', profile._id);

    const testImagePath = path.join(__dirname, 'test-avatar.png');
    
    if (fs.existsSync(testImagePath)) {
        const buffer = fs.readFileSync(testImagePath);
        const relativePath = await saveAvatar(buffer, String(profile._id), 'image/png');
        console.log('Avatar saved:', relativePath);

        await ProfileService.updateProfile(createdUser._id, { avatar: relativePath });
        console.log('Profile updated with avatar');
    } else {
        console.log('Test image not found at:', testImagePath);
        console.log('Create a test-avatar.png file or use any image for testing');
    }

    await mongoose.disconnect();
    console.log('Done');
}

test().catch(console.error);
