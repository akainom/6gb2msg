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
    emailHash: {
        type: String,
        required: true
    },
    authProvider: {
        type: String,
        unique  : true,
        sparse: true
    },
    password: {
        type: String,
        required: function() {
            return !this.authProvider
        },
        select: false
    },
    ssoId: {
        required: false,
        type: String,
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

UserSchema.index({ ssoId: 1, emailHash: 1 });

const User = mongoose.model('User', UserSchema);

module.exports = User;
