const mongoose = require('mongoose');
const { Schema } = mongoose;

const ProfileShema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minLength: 5
    },
    avatar: {
        type: String,
        default: 'transparent.png'
    },
    bio: {
        type: String,
        maxLength: 1000,
        default: ''
    },
    location: {
        type: String,
        default: ''
    },
    status: {
        type: Number,
        enum: ['online', 'offline', 'do not disturb', 'away'],
        default: 'offline' 
    },
    last_online: {
        type: Date,
    },
}, {
    timestamps: true,
    collection: 'profiles'
});

const Profile = mongoose.model('Profile', ProfileShema);

module.exports = Profile;