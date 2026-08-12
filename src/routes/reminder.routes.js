const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const reminderController = require('../controllers/reminderController');

router.use(authenticate);
router.use(authorize('owner', 'staff'));

router.post('/send', reminderController.sendReminder.bind(reminderController));
router.get('/', reminderController.getReminders.bind(reminderController));

module.exports = router;
