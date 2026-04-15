const es = require('./es.client');

const IDX_PROFILES = process.env.ELASTIC_INDEX_PROFILES || 'profiles_v1';
const IDX_CHATS = process.env.ELASTIC_INDEX_CHATS || 'chats_v1';
const IDX_MESSAGES = process.env.ELASTIC_INDEX_MESSAGES || 'messages_v1';

const PROFILE_MAPPING = {
    properties: {
        username: { 
            type: 'text', 
            analyzer: 'standard',
            fields: {
                raw: { type: 'keyword' }
            }
        },
        email: { type: 'text' },
        displayName: { type: 'text' },
        bio: { type: 'text' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
    },
};

const CHAT_MAPPING = {
    properties: {
        type: { type: 'keyword' },
        title: { type: 'text' },
        participant_ids: { type: 'keyword' },
        last_message_text: { type: 'text' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
    },
};

const MESSAGE_MAPPING = {
    properties: {
        chat_id: { type: 'keyword' },
        sender_id: { type: 'keyword' },
        content: { type: 'text' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
    },
};

async function ensureIndices() {
    const indices = [
        [IDX_PROFILES, PROFILE_MAPPING],
        [IDX_CHATS, CHAT_MAPPING],
        [IDX_MESSAGES, MESSAGE_MAPPING],
    ];

    for (const [idx, mapping] of indices) {
        try {
            await es.indices.create({ 
                index: idx, 
                mappings: mapping,
                settings: { number_of_shards: 1, number_of_replicas: 0 }
            });
        } catch (e) {
            if (e?.meta?.body?.error?.type !== 'resource_already_exists_exception') {
                throw e;
            }
        }
    }
    await es.indices.refresh({ index: IDX_PROFILES });
}

module.exports = { ensureIndices, IDX_PROFILES, IDX_CHATS, IDX_MESSAGES };
