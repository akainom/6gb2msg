const mongoose = require('mongoose');
const { Schema } = mongoose;

const ParticipantSchema = new Schema({
    user_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ['owner', 'member'],
        default: 'member'
    },
    joined_at: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const ChatSchema = new Schema({
    type: {
        type: String,
        enum: ['private', 'group'],
        required: true,
        default: 'private'
    },
    title: {
        type: String,
        trim: true,
        maxlength: 128
    },
    avatar: {
        type: String,
        default: null
    },
    participants: {
        type: [ParticipantSchema],
        required: true,
        validate: {
            validator: function(arr) {
                // private: exactly 2, group: 2+
                if (this.type === 'private') return arr.length === 2;
                return arr.length >= 2;
            },
            message: 'Invalid participants count for chat type'
        }
    },
    last_message: {
        message_id: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
        text:       { type: String, default: null },
        sent_at:    { type: Date, default: null }
    }
}, {
    timestamps: true,
    collection: 'chats'
});

ChatSchema.index({ 'participants.user_id': 1 });
ChatSchema.index(
    { type: 1, 'participants.user_id': 1 },
    { unique: false }
);

const Chat = mongoose.model('Chat', ChatSchema);

module.exports = Chat;