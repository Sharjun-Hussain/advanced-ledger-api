const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const textLkController = require('../controllers/textLkController');

router.use(authenticate);
router.use(authorize('owner', 'staff'));

router.get('/config', textLkController.getConfig);
router.post('/config', textLkController.saveConfig);
router.post('/test-connection', textLkController.testConnection);
router.get('/contacts', textLkController.getContacts);
router.post('/contacts/groups', textLkController.createContactGroup);
router.patch('/contacts/groups/:uid', textLkController.updateContactGroup);
router.delete('/contacts/groups/:uid', textLkController.deleteContactGroup);
router.post('/sms/send', textLkController.sendSms);
router.post('/sync-customers', textLkController.syncCustomers);
router.get('/templates', textLkController.getTemplates);
router.post('/templates', textLkController.createTemplate);
router.delete('/templates/:id', textLkController.deleteTemplate);
router.get('/campaigns', textLkController.getCampaigns);
router.post('/campaigns', textLkController.createCampaign);
router.get('/stats', textLkController.getStats);

module.exports = router;
