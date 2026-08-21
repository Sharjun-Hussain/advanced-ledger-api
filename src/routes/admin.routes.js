const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');

const upload = require('../middleware/upload');

// Allow login without authentication
router.post('/login', authController.loginAdmin.bind(authController));

router.use(authenticate);
router.use(authorize('admin'));

router.get('/stats', adminController.getStats.bind(adminController));
router.get('/activity-logs', adminController.getActivityLogs.bind(adminController));
router.get('/activity-logs/:id', adminController.getActivityLogById.bind(adminController));
router.get('/shops', adminController.getShops.bind(adminController));
router.get('/shops/:id', adminController.getShopById.bind(adminController));
router.post('/shops', upload.single('logo'), adminController.createShop.bind(adminController));
router.patch('/shops/:id', upload.single('logo'), adminController.updateShop.bind(adminController));
router.patch('/shops/:id/toggle', adminController.toggleShopStatus.bind(adminController));
router.delete('/shops/:id', adminController.deleteShop.bind(adminController));

router.get('/plans', adminController.getPlans.bind(adminController));
router.post('/plans', adminController.createPlan.bind(adminController));
router.patch('/plans/:id', adminController.updatePlan.bind(adminController));
router.delete('/plans/:id', adminController.deletePlan.bind(adminController));

module.exports = router;
