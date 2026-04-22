const { als } = require('./als');

function getUserId(req) {
    const store = als.getStore();
    return store?.get('userId') ?? req.headers['x-user-id'];
}

function getProfileId(req) {
    const store = als.getStore();
    return store?.get('profileId') ?? req.headers['x-profile-id'];
}

module.exports = { getUserId, getProfileId };