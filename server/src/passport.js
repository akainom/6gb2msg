const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { AuthService } = require('./services/auth.service');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (oauthAccessToken, oauthRefreshToken, _profile, done) => {
            try {
                console.log('[Passport] Google strategy callback fired');
                const response = await fetch(
                    'https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses,photos,metadata',
                    { headers: { Authorization: `Bearer ${oauthAccessToken}`, 'Content-Type': 'application/json' } }
                );

                console.log('[Passport] People API status:', response.status);

                if (!response.ok) {
                    console.log('[Passport] People API error:', response.status);
                    return done(new Error(`People API error: ${response.status}`), null);
                }

                const peopleData = await response.json();

                const avatar = peopleData.photos?.[0]?.url ?? null;
                const displayName = peopleData.names?.[0]?.displayName ?? '';

                console.log('[Passport] avatar URL:', avatar, 'displayName:', displayName);

                const result = await AuthService.authenticateOAuthGoogle(
                    peopleData,
                    avatar,
                    displayName,
                    oauthRefreshToken
                );

                return done(null, result);
            } catch (e) {
                console.log('[Passport] strategy error:', e.message);
                return done(e, null);
            }
        }
    )
);

module.exports = passport;
