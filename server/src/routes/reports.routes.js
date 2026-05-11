const express = require('express');
const router = express.Router();
const ReportController = require('../controllers/report.controller');

router.post('/', ReportController.create.bind(ReportController));

router.get('/', ReportController.listMy.bind(ReportController));

router.delete('/:reportId', ReportController.delete.bind(ReportController));

router.get('/pending', ReportController.listPending.bind(ReportController));

router.post('/ban', ReportController.ban.bind(ReportController));

router.post('/unban', ReportController.unban.bind(ReportController));

router.patch('/:reportId/dismiss', ReportController.dismiss.bind(ReportController));

module.exports = router;
