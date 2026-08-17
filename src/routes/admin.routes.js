const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');

// Allow login without authentication
router.post('/login', authController.loginAdmin.bind(authController));

router.use(authenticate);
router.use(authorize('admin'));

router.get('/stats', adminController.getStats.bind(adminController));
router.get('/shops', adminController.getShops.bind(adminController));
router.post('/shops', adminController.createShop.bind(adminController));
router.patch('/shops/:id', adminController.updateShop.bind(adminController));
router.delete('/shops/:id', adminController.deleteShop.bind(adminController));
router.get('/plans', adminController.getPlans.bind(adminController));

module.exports = router;
