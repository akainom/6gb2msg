const { AsyncLocalStorage } = require('node:async_hooks');
const UserRepo = require('../repos/user.repo');
const ProfileRepo = require('../repos/profile.repo');
const als = new AsyncLocalStorage();

const alsmiddleware = async (req, res, next) => {
    const userid = req.headers['x-user_id'];
    const profileid = req.headers['x-profile-id'];
    if (!userid) {
        return next();
    }

    als.run(new Map(), async () => {
        const store = als.getStore();

        const user = await UserRepo.getById(userid);
        if (profileid) {
            let profile = await ProfileRepo.getById(profileid);
            store.set('profile', profile);
        }
        store.set('user', user);

        next();
    })
} 

module.exports = {als, alsmiddleware};