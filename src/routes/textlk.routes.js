const express = require('express');
const router = express.Router();
const textLkController = require('../controllers/textLkController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/config', textLkController.getConfig);
router.post('/config', authorize('owner', 'admin'), textLkController.saveConfig);
router.post('/test', authorize('owner', 'admin'), textLkController.testConnection);
router.get('/stats', textLkController.getStats);
router.get('/contacts', textLkController.getContacts);
router.post('/contacts', authorize('owner', 'admin', 'staff'), textLkController.createContactGroup);
router.patch('/contacts/:uid', authorize('owner', 'admin', 'staff'), textLkController.updateContactGroup);
router.delete('/contacts/:uid', authorize('owner', 'admin', 'staff'), textLkController.deleteContactGroup);
router.post('/sync', authorize('owner', 'admin', 'staff'), textLkController.syncCustomers);
router.post('/send', textLkController.sendSms);

// Templates
router.get('/templates', textLkController.getTemplates);
router.post('/templates', authorize('owner', 'admin', 'staff'), textLkController.createTemplate);
router.delete('/templates/:id', authorize('owner', 'admin', 'staff'), textLkController.deleteTemplate);

// Campaigns
router.get('/campaigns', textLkController.getCampaigns);
router.post('/campaigns', authorize('owner', 'admin', 'staff'), textLkController.createCampaign);

module.exports = router;
