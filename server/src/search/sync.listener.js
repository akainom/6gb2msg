const { ensureIndices, IDX_PROFILES, IDX_CHATS, IDX_MESSAGES } = require('./es.indices');

let indicesReady = false;

async function initSearchIndices() {
    if (indicesReady) return;
    await ensureIndices();
    indicesReady = true;
}

async function refreshAllIndices() {
    const es = require('./es.client');
    await Promise.all([
        es.indices.refresh({ index: IDX_PROFILES }).catch(() => {}),
        es.indices.refresh({ index: IDX_CHATS }).catch(() => {}),
        es.indices.refresh({ index: IDX_MESSAGES }).catch(() => {}),
    ]);
}

module.exports = { initSearchIndices, refreshAllIndices };
