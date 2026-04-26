const express = require('express');
const router = express.Router();
const AppStatsController = require('../controllers/stats.controller');

// GET /stats — public, no auth
router.get('/', AppStatsController.get.bind(AppStatsController));

module.exports = router;