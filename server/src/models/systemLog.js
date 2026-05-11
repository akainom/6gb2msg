const mongoose = require('mongoose');
const { Schema } = mongoose;

const SystemLogSchema = new Schema({
    event: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    details: {
        type: Schema.Types.Mixed,
        default: {}
    },
    ip: {
        type: String,
        default: null
    }
}, {
    timestamps: true,
    collection: 'system_logs'
});

SystemLogSchema.index({ createdAt: -1 });
SystemLogSchema.index({ event: 1, createdAt: -1 });

const SystemLog = mongoose.model('SystemLog', SystemLogSchema);

module.exports = SystemLog;
