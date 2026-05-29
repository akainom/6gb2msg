const { als } = require('./als');
const TokenService = require('../services/token.service');
const { ProfileRepo } = require('../repos/profile.repo');
const UserRepo = require('../repos/user.repo');
const Encryptor = require('../services/enc.service');

/**
 * @type {string[]}
 */
const publicPaths = [
    '/auth/register',
    '/auth/login',
    '/auth/refresh',
    '/auth/oauth',
    '/files/avatar',
    '/files/chat-avatar',
    '/files/attachment',
    '/stats'
];

/**
 * @description Checks if the given path matches any publicly accessible endpoint
 * @param {string} path
 * @returns {boolean}
 */
function isPublicPath(path) {
    return publicPaths.some(p => path.startsWith(p));
}

/**
 * @description Express middleware for JWT authentication with ban/fingerprint/profile checks
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
const authMiddleware = async (req, res, next) => {
    if (isPublicPath(req.path)) {
        try {
            const authHeader = req.headers['authorization'];
            if (authHeader?.startsWith('Bearer ')) {
                const accessToken = authHeader.slice(7);
                const decoded = TokenService.verifyAccessToken(accessToken);
                req.headers['x-user-id'] = decoded.userid;
            }
        } catch {}
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

        if (user.bannedUntil) {
            if (new Date(user.bannedUntil) > new Date()) {
                return res.status(403).json({
                    code: 'ERR_USER_BANNED',
                    message: 'User is banned',
                    reason: user.banReason,
                    until: user.bannedUntil
                });
            } else {
                await UserRepo.transactCall(
                    async (self, bag, session) => {
                        await self.unbanUser(userId, session);
                    },
                    null,
                    {}
                );
            }
        }

        if (fprint) {
            const isValidFprint = Encryptor.compareFprint(fprint, claim);
            if (!isValidFprint) {
                return res.status(401).json({
                    code: 'ERR_FPRINT_INV',
                    message: 'fingerprint is not valid',
                    action: 'relogin'
                });
            }
        }

        const profile = await ProfileRepo.getByUserId(userId);

        if (profile && !profile.isComplete) {
            if (req.path.startsWith('/profiles/by-user/')
                || req.path.startsWith('/auth/oauth/complete')) {
                // Allow access to own profile and OAuth completion
            } else {
                return res.status(403).json({
                    code: 'ERR_PROFILE_INCOMPLETE',
                    message: 'Profile registration is not complete',
                    action: 'complete_profile',
                    details: { user_id: userId }
                });
            }
        }

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
