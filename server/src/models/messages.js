const mongoose = require('mongoose');
const { Schema } = mongoose;

const MessageSchema = new Schema({
  chat_id: {
    type: Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true 
  },
  sender_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: function() { return this.attachments.length === 0; }
  },
  attachments: [{
    file_path: String,
    mime_type: String,
    original_name: String,
    size: Number
  }],
  is_edited: {
    type: Boolean,
    default: false
  },
  status: {
    is_read: { 
      type: Boolean, 
      default: false 
    },
    read_at: { 
      type: Date
    }
  }
}, {
  timestamps: true, 
  collection: 'messages'
});

MessageSchema.index({ chat_id: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);