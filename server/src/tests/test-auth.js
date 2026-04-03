const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({
    path: __dirname + '/server.test.env'
})
const connect = require('../db/connect');
const { als } = require('../services/als');
const {AuthService, regDTO, loginDTO} = require('../services/auth.service');
const { ProfileRepo } = require('../repos/profile.repo');

(async () => {
    try {
        await connect()        

        const testUserData = new regDTO('example.com', '12345', 'test_user', 'self', '', 'User');
        await als.run(new Map(), async () => {
            console.log(`test user regDTO: \n${JSON.stringify(testUserData, null, 2)}`);

            const result = await AuthService.registerUser(testUserData);

            console.log(`=========== RESULTS ===========`);
            console.log(`profile: \n${JSON.stringify(result.profile, null, 2)}`);
            console.log(`user: \n${JSON.stringify(result.newUser, null, 2)}`);
            console.log(`access token: \n${(result.accessToken)}`);
            console.log(`refresh token: \n${(result.refreshToken)}`);

            const store = als.getStore();
            console.log(`ALS store: ${Object.fromEntries(store)}`);

            console.log(`\n=========== TRYING TO LOG IN ===========\n`);
            const loginResult = await AuthService.login(new loginDTO(testUserData.username, testUserData.email, testUserData.password));
            console.log(`login result: ${loginResult}`);

            console.log('deleted: ' + await ProfileRepo.deleteProfileWithUser(result.profile._id));
            
        })
    }
    catch (e) {
        console.error(`FATAL :${e}`);
        if (e.cause.code) {
            console.log(`code: ${e.cause.code}, val: ${e.cause.val}`);
        }
    }
    finally {
        await mongoose.disconnect();
        console.log(`disconnected`);
    }
})();