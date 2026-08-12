const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const customerAppController = require('../controllers/customerAppController');

router.use(authenticate);

router.get('/me', customerAppController.getProfile.bind(customerAppController));
router.get('/transactions', customerAppController.getTransactions.bind(customerAppController));
router.get('/loans', customerAppController.getLoans.bind(customerAppController));
router.get('/schedule', customerAppController.getSchedule.bind(customerAppController));

module.exports = router;
