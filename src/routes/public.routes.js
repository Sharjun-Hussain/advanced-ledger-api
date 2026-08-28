const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/config', publicController.getConfig.bind(publicController));

module.exports = router;
