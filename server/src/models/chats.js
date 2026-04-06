const mongoose = require('mongoose');
const { Schema } = mongoose;

const ChatSchema = new Schema({
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  type: {
    type: String,
    enum: ['private', 'group'],
    default: 'private'
  },
  title: {
    type: String,
    trim: true
  },
  last_message: {
    message_id: { type: Schema.Types.ObjectId, ref: 'Message' },
    text: String,
    sender_id: { type: Schema.Types.ObjectId, ref: 'User' },
    sent_at: { type: Date }
  }
}, {
  timestamps: true,
  collection: 'chats'
});

ChatSchema.index({ participants: 1 });

module.exports = mongoose.model('Chat', ChatSchema);