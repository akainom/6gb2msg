const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({
    path: __dirname + '/server.test.env'
})
const connectDB = require('../db/connect');
const { als } = require('../mw/als');
const {AuthService, regDTO, loginDTO} = require('../services/auth.service');
const { ProfileRepo } = require('../repos/profile.repo');
const userRepo = require('../repos/user.repo');

const a = `
 {
   "photos": [
     {
       "url": "https://lh3.googleusercontent.com/a/ACg8ocKkmhS9wVeqCpyp31x8iglv-wu3uuXbNjTrIUCIo645qD3Rfw=s100", 
       "default": true,
       "metadata": {
         "source": {
           "type": "PROFILE", 
           "id": "103859078901638755607"
         },
         "primary": true
       }
     }
   ],
   "etag": "%EiEBAgMEBQYHCAkKCwwNDg8QERITFBUXGSIlLjQ1Nz0+P0AaBAECBQc=",
   "names": [
     {
       "displayNameLastFirst": "Professional, Vladik",
       "displayName": "Vladik Professional",
       "familyName": "Professional",
       "unstructuredName": "Vladik Professional",
       "givenName": "Vladik", 
       "metadata": {
         "source": {
           "type": "PROFILE",
           "id": "103859078901638755607"
         },
         "primary": true,
         "sourcePrimary": true
       }
     }
   ],
   "resourceName": "people/103859078901638755607",
   "emailAddresses": [
     {
       "value": "akinomfasik@gmail.com",
       "metadata": {
         "source": {
           "type": "ACCOUNT",
           "id": "103859078901638755607"
         },
         "verified": true,
         "primary": true,
         "sourcePrimary": true
       }
     }
   ],
   "coverPhotos": [
     {
       "url": "https://lh3.googleusercontent.com/c5dqxl-2uHZ82ah9p7yxrVF1ZssrJNSV_15Nu0TUZwzCWqmtoLxCUJgEzLGtxsrJ6-v6R6rKU_-FYm881TTiMCJ_=s1600", 
       "default": true,
       "metadata": {
         "source": {
           "type": "PROFILE",
           "id": "103859078901638755607"
         },
         "primary": true
       }
     }
   ],
   "metadata": {
     "sources": [
       {
         "updateTime": "2026-04-04T15:55:28.446175Z",
         "etag": "#ql+WvLqsUJE=", 
         "type": "PROFILE",
         "id": "103859078901638755607",
         "profileMetadata": {
           "userTypes": [
             "GOOGLE_USER"
           ],
           "objectType": "PERSON"
         }
       }
     ],
     "objectType": "PERSON"
   }
 }`;
const googleAuthDataExample = JSON.parse(a);

(async () => {
    try {
        await connectDB();        
        
        const testUserData = new regDTO('example.com', '12345', 'test_user', '', '', 'User');
        await als.run(new Map(), async () => {
            console.log(`test user regDTO: \n${JSON.stringify(testUserData, null, 2)}`);

            const googleResult = await AuthService.authenticateOAuthGoogle(googleAuthDataExample, 'transparent.png');
            const completeResult = await AuthService.completeOAuthRegistration(googleResult.user_id, {
              username: 'google_user',
              bio: '21 y.o designer from San Francisko',
              location: 'San Francisko',
              avatar: 'avatar.jpg'
            });

            const result = await AuthService.registerUser(testUserData);

            console.log(`=========== RESULTS ===========`);
            console.log(`profile: \n${JSON.stringify(result.profile, null, 2)}`);
            console.log(`user: \n${JSON.stringify(result.user, null, 2)}`);
            console.log(`access token: \n${(result.accessToken)}`);
            console.log(`refresh token: \n${(result.refreshToken)}`);

            const store = als.getStore();
            console.log(`ALS store: ${Object.fromEntries(store)}`);

            console.log(`\n=========== TRYING TO LOG IN ===========\n`);
            const loginResult = await AuthService.login(new loginDTO(testUserData.username, testUserData.password));
            console.log(`login result: ${JSON.stringify(loginResult)}`);

            console.log('deleted: ' + await ProfileRepo.deleteProfileWithUser(result.profile._id));
            
        })
    }
    catch (e) {
        console.error(`FATAL :${e}`);
        if (e.code) {
            console.log(`code: ${e.code}, val: ${e.val}`);
        }
    }
    finally {
        await mongoose.disconnect();
        console.log(`disconnected`);
    }
})();