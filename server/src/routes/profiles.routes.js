const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profile.controller');

router.get('/search', ProfileController.search.bind(ProfileController));

router.get('/:profileId', ProfileController.getOne.bind(ProfileController));

router.get('/by-user/:userId', ProfileController.getByUserId.bind(ProfileController));

router.patch('/me', ProfileController.update.bind(ProfileController));

router.delete('/me', ProfileController.delete.bind(ProfileController));

module.exports = router;