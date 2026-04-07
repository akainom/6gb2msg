const mongoose = require('mongoose');
const { Schema } = mongoose;

const AttachmentSchema = new Schema({
    file_path:     { type: String, required: true },
    mime_type:     { type: String, required: true },
    original_name: { type: String, required: true },
    size:          { type: Number, required: true }
}, { _id: false });

const MessageSchema = new Schema({
    chat_id: {
        type: Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    sender_id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: function() {
          return !this.attachments;
        }
    },
    attachments: {
        type: [AttachmentSchema],
        default: []
    },
    is_edited: {
        type: Boolean,
        default: false
    },
    is_forwarded: {
        type: Boolean,
        default: false
    },
    forwarded_by: {
        type: Schema.Types.ObjectId,
        required: function() {
            return this.is_forwarded === true;
        }
    },
    status: {
        is_read: { type: Boolean, default: false },
        read_at: { type: Date,    default: null  }
    }
}, {
    timestamps: true,
    collection: 'messages'
});

MessageSchema.index({ chat_id: 1, createdAt: -1 });
MessageSchema.index({ sender_id: 1 });

module.exports = mongoose.model('Message', MessageSchema);