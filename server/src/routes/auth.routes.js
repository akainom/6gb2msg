const express = require('express');
const passport = require('passport');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');

// POST /auth/register
router.post('/register', AuthController.register.bind(AuthController));

// POST /auth/login
router.post('/login', AuthController.login.bind(AuthController));

// POST /auth/logout
router.post('/logout', AuthController.logout.bind(AuthController));

// POST /auth/logout-all  
router.post('/logout-all', AuthController.logoutAll.bind(AuthController));

// POST /auth/refresh  
router.post('/refresh', AuthController.refresh.bind(AuthController));




/*
// GET /auth/oauth/google  
router.get(
    '/oauth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        session: false,
    })
);

// GET /auth/oauth/google/callback  
router.get(
    '/oauth/google/callback',
    passport.authenticate('google', {
        session: false,
        failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
    }),
    AuthController.googleOAuthCallback.bind(AuthController)
);

// POST /auth/oauth/complete  
router.post('/oauth/complete', AuthController.completeOAuthProfile.bind(AuthController));
*/
module.exports = router;