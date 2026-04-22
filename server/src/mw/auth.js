const { als } = require('./als');
const TokenService = require('../services/token.service');
const { ProfileRepo } = require('../repos/profile.repo');
const UserRepo = require('../repos/user.repo');
const Encryptor = require('../services/enc.service');

const publicPaths = [
    '/auth/register',
    '/auth/login',
    '/auth/refresh'
];

function isPublicPath(path) {
    return publicPaths.some(p => path.startsWith(p));
}

const authMiddleware = async (req, res, next) => {
    if (isPublicPath(req.path)) {
        return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
            code: 'ERR_AUTH_REQUIRED',
            message: 'Authorization required'
        });
    }

    const accessToken = authHeader.slice(7);

    try {
        const decoded = TokenService.verifyAccessToken(accessToken);
        const userId = decoded.userid;
        const claim = decoded.fprint;
        const fprint = req.cookies['fprint'];

        const user = await UserRepo.getById(userId);
        if (!user) {
            return res.status(401).json({
                code: 'ERR_USER_NOT_FOUND',
                message: 'user not found',
                action: 'relogin'
            });
        }

        const isValidFprint = Encryptor.compareFprint(fprint, claim);
        if (!isValidFprint) {
            return res.status(401).json({
                code: 'ERR_FPRINT_INV',
                message: 'fingerprint is not valid',
                action: 'relogin'
            });
        }        

        const profile = await ProfileRepo.getByUserId(userId);

        als.run(new Map(), () => {
            const store = als.getStore();
            store.set('userId', userId);
            store.set('profileId', profile?._id);

            req.headers['x-user-id'] = userId;
            req.headers['x-profile-id'] = profile?._id;

            next();
        });
    } catch (e) {
        return res.status(401).json({
            code: 'ERR_TOKEN_INVALID',
            message: 'Invalid or expired access token',
            action: 'refresh_access_token'
        });
    }
};

module.exports = authMiddleware;