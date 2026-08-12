const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

router.use(authenticate);
router.use(authorize('owner'));

router.get('/summary', reportController.getSummary.bind(reportController));
router.get('/export', reportController.exportCsv.bind(reportController));

module.exports = router;
