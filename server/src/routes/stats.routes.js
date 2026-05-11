const express = require('express');
const router = express.Router();
const AppStatsController = require('../controllers/stats.controller');

router.get('/', AppStatsController.get.bind(AppStatsController));
router.get('/logs', AppStatsController.listLogs.bind(AppStatsController));

module.exports = router;
