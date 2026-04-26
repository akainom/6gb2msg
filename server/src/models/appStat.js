const mongoose = require('mongoose');
const { Schema } = mongoose;

const AppStatsSchema = new Schema({
    // sentinel key — always the same, ensures single document
    _key: { type: String, default: 'global', unique: true },

    users: {
        total:        { type: Number, default: 0 },
        active_today: { type: Number, default: 0 },
        active_week:  { type: Number, default: 0 },
    },
    chats: {
        total:   { type: Number, default: 0 },
        private: { type: Number, default: 0 },
        group:   { type: Number, default: 0 },
    },
    messages: {
        total:     { type: Number, default: 0 },
        last_24h:  { type: Number, default: 0 },
        last_week: { type: Number, default: 0 },
    },
    computed_at: { type: Date, default: null },
}, {
    timestamps: false,
    collection: 'app_stats',
});

module.exports = mongoose.model('AppStats', AppStatsSchema);