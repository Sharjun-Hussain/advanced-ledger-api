const express = require('express');
const router = express.Router();
// Assuming we convert auth.js middleware to CommonJS
const { authenticate, authorize } = require('../middleware/auth');
const shopController = require('../controllers/shopController');
const upload = require('../middleware/upload');

router.use(authenticate);
router.use(authorize('owner'));

router.get('/', shopController.getProfile.bind(shopController));
router.patch('/', upload.single('logo'), shopController.updateProfile.bind(shopController));
router.get('/dashboard', shopController.getDashboard.bind(shopController));
router.post('/staff', shopController.addStaff.bind(shopController));
router.get('/staff', shopController.getStaff.bind(shopController));
router.patch('/staff/:id', shopController.updateStaff.bind(shopController));

module.exports = router;
