const mongoose = require('mongoose');
const { Schema } = mongoose;

const ProfileSchema = new Schema({
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
        type: String,
        enum: ['online', 'offline', 'do not disturb', 'away'],
        set: v => v === '' ? 'offline' : v,
        default: 'offline' 
    },
    last_online: {
        type: Date,
    },
    isComplete: {
        type: Boolean,
        default: false,
        required: true
    }
}, {
    timestamps: true,
    collection: 'profiles'
});

ProfileSchema.methods.getUser = async function(session = null) {
    if (this.populated('user_id')) {
        return this.user_id;
    }

    await this.populate({
        path: 'user_id',
        options: { session }
    })

    return this.user_id;
}

const Profile = mongoose.model('Profile', ProfileSchema);

module.exports = Profile;