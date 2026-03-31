const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema ({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: function() {
            return !this.authProvdider
        },
        select: false
    },
    authProvdider: {
        type: String,
        unique: true,
        sparse: true
    },
    role: {
        type: String,
        enum: ['User', 'Admin'],
        default: 'User'
    },
    refreshTokens: [{
        token: {
            type: String,
            required: true
        },
        deviceId: {
            type: String
        },
        createdAt: {
            type: Date,
            default: Date.now()
        },
        expiresAt: {
            type: Date,
            default: Date.now()
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now()
    }
}, {
    timestamps: true,
    collection: 'users'
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
