const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { AuthService } = require('./services/auth.service');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
            userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
        },
        async (oauthAccessToken, oauthRefreshToken, _profile, done) => {
            try {
                const response = await fetch(
                    'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos,metadata',
                    { headers: { Authorization: `Bearer ${oauthAccessToken}` } }
                );

                if (!response.ok) {
                    return done(new Error(`People API error: ${response.status}`), null);
                }

                const peopleData = await response.json();

                const avatar = peopleData.photos?.[0]?.url ?? null;

                const result = await AuthService.authenticateOAuthGoogle(
                    peopleData,
                    avatar,
                    oauthRefreshToken
                );

                return done(null, result);
            } catch (e) {
                return done(e, null);
            }
        }
    )
);

module.exports = passport;