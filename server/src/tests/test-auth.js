const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({
    path: __dirname + '/server.test.env'
})

const { als } = require('../services/als');
const {AuthService, regDTO} = require('../services/auth.service');

(async () => {
    try {
        await mongoose.connect('mongodb://192.168.100.8:2000/6gb2msg?directConnection=true&replicaSet=rs0');
        console.log('mongoDB connected');        

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

            
        })
    }
    catch (e) {
        console.error(`FATAL :${e}`);
    }
    finally {
        await mongoose.disconnect();
        console.log(`disconnected`);
    }
})();