const { AuthService, regDTO, loginDTO } = require('../services/auth.service');
const { ApiError } = require('../mw/exception');
const validator = require('validator');

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days in ms
};

const FPRINT_COOKIE_NAME = 'fprint';
const FPRINT_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 15 * 24 * 60 * 60 * 1000,
};

/**
 * @description sets refreshToken, fprint as HttpOnly + Secure and returns accessToken in body
 */
function sendTokens(res, accessToken, refreshToken, fprint) {
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie(FPRINT_COOKIE_NAME, fprint, FPRINT_COOKIE_OPTIONS);
    return { accessToken };
}

/**
 * @description clears refreshToken and fprint cookies
 */
function clearRefreshCookie(res) {
    res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.clearCookie(FPRINT_COOKIE_NAME, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
    });
}

function validateEmail(email) {
    if (!email) return false;
    return validator.isEmail(email);
}

function validatePassword(password) {
    if (!password) return false;
    return validator.isStrongPassword(password, {
                    minSymbols: 0,
                    minUppercase: 0,
                    minLowercase: 0
                });
}

function validateUsername(username) {
    const len = username.length > 5 && username.length < 16;
    const lang = /^[a-zA-Z0-9_]+$/.test(username);
    return len & lang;
}

class AuthController {

    /**
     * POST /auth/register
     * Body: { email, password, username }
     */
    async register(req, res, next) {
        try {
            const { email, password, username } = req.body ?? {}

            if (!validateEmail(email) || !validatePassword(password) || !validateUsername(username)) {
                throw ApiError.BadRequest('invalid fields', 'ERR_FIELDS_INV', { email, password, username });
            }

            const dto = new regDTO(email, password, username, 'local');
            const { profile, user, accessToken, refreshToken, fprint } = await AuthService.registerUser(dto);

            const tokens = sendTokens(res, accessToken, refreshToken, fprint);

            return res.status(201).json({
                status: 'ok',
                data: {
                    ...tokens,
                    user_id: user._id,
                    profile,
                }
            });
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /auth/login
     * Body: { username, password }
     */
    async login(req, res, next) {
        try {
            const { username, password } = req.body ?? {}

            if (!username || !password) {
                throw ApiError.BadRequest('missing required fields', 'ERR_FIELDS_MISSING', { username });
            }

            const dto = new loginDTO(username, password);
            const { accessToken, refreshToken, fprint, ...rest } = await AuthService.login(dto);

            const tokens = sendTokens(res, accessToken, refreshToken, fprint);

            return res.status(200).json({
                status: 'ok',
                data: { ...tokens, ...rest }
            });
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /auth/logout
     */
    async logout(req, res, next) {
        try {
            const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
            const userid = req.headers['x-user-id'] ?? req.body.userid;

            if (!refreshToken || !userid) {
                throw ApiError.BadRequest('missing credentials', 'ERR_CREDS_MISSING', null);
            }

            await AuthService.logout(userid, refreshToken);
            clearRefreshCookie(res);

            return res.status(200).json({ status: 'ok' });
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /auth/logout-all
     */
    async logoutAll(req, res, next) {
        try {
            const userid = req.headers['x-user-id'] ?? req.body.userid;

            if (!userid) {
                throw ApiError.BadRequest('missing user id', 'ERR_UID_MISSING', null);
            }

            await AuthService.logoutAllTokens(userid);
            clearRefreshCookie(res);

            return res.status(200).json({ status: 'ok' });
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /auth/refresh
     */
    async refresh(req, res, next) {
        try {
            const refreshToken = req.cookies[REFRESH_COOKIE_NAME];
            const userid = req.headers['x-user-id'] ?? req.body.userid;

            if (!refreshToken || !userid) {
                throw ApiError.BadRequest('missing credentials', 'ERR_CREDS_MISSING', null);
            }

            const result = await AuthService.exchangeRefreshToken(userid, refreshToken);

            if (!result) {
                clearRefreshCookie(res);
                throw ApiError.Forbidden('refresh token invalid or expired', 'ERR_REFR_INV', null);
            }

            const tokens = sendTokens(res, result.accessToken, result.refreshToken, result.fprint);

            return res.status(200).json({
                status: 'ok',
                data: tokens
            });
        } catch (e) {
            next(e);
        }
    }

    /**
     * GET /auth/oauth/google
     * Initiates Google OAuth (handled by passport)
     */
    googleOAuthInit(req, res, next) {
        next();
    }

    /**
     * GET /auth/oauth/google/callback
     */
    async googleOAuthCallback(req, res, next) {
        try {
            const { accessToken, refreshToken, user_id, profile } = req.user;

            if (!profile.isComplete) {
                res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
                return res.redirect(
                    `${process.env.CLIENT_URL}/complete-profile?token=${accessToken}&uid=${user_id}`
                );
            }

            sendTokens(res, accessToken, refreshToken);
            return res.redirect(`${process.env.CLIENT_URL}/auth/success?token=${accessToken}`);
        } catch (e) {
            next(e);
        }
    }

    /**
     * POST /auth/oauth/complete
     * Body: { username, bio?, location?, avatar? }
     */
    async completeOAuthProfile(req, res, next) {
        try {
            const userid = req.headers['x-user-id'] ?? req.body.userid;
            const { username, bio, location, avatar } = req.body ?? {}

            if (!userid || !username) {
                throw ApiError.BadRequest('missing required fields', 'ERR_FIELDS_MISSING', { userid, username });
            }

            const profile = await AuthService.completeOAuthRegistration(userid, {
                username, bio, location, avatar
            });

            return res.status(200).json({
                status: 'ok',
                data: { profile }
            });
        } catch (e) {
            next(e);
        }
    }
}

module.exports = new AuthController();