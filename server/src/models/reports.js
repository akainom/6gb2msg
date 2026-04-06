const mongoose = require('mongoose');
const { Schema } = mongoose;

const ReportSchema = new Schema({
  reporter_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reported_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['spam', 'harassment', 'inappropriate_content', 'other']
  },
  description: {
    type: String,
    maxlength: 500
  },
  message_id: {
    type: Schema.Types.ObjectId,
    ref: 'Message'
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'dismissed'],
    default: 'pending'
  }
}, {
  timestamps: true,
  collection: 'reports'
});

ReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', ReportSchema);