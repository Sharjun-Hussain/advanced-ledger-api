const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const reminderController = require('../controllers/reminderController');

router.use(authenticate);
router.use(authorize('owner', 'staff'));

router.post('/send', require('../middleware/rateLimiter').smsLimiter, reminderController.sendReminder.bind(reminderController));
router.post('/send-bulk', require('../middleware/rateLimiter').smsLimiter, reminderController.sendBulk.bind(reminderController));
router.post('/run-automation', reminderController.runAutomation.bind(reminderController));
router.get('/', reminderController.getReminders.bind(reminderController));

// Per-shop customizable policy (web dashboard + mobile automation screen).
router.get('/policy', reminderController.getPolicy.bind(reminderController));
router.put('/policy', reminderController.savePolicy.bind(reminderController));

// Automation rules (conditions + templates).
router.get('/rules', reminderController.getRules.bind(reminderController));
router.post('/rules', reminderController.saveRule.bind(reminderController));
router.delete('/rules/:id', reminderController.deleteRule.bind(reminderController));

module.exports = router;
