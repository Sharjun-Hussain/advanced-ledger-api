const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const distributorController = require('../controllers/distributorController');

router.use(authenticate);
router.use(authorize('owner', 'staff'));

router.get('/', distributorController.getDistributors.bind(distributorController));
router.post('/', distributorController.addDistributor.bind(distributorController));
router.get('/:id', distributorController.getDistributor.bind(distributorController));
router.patch('/:id', distributorController.updateDistributor.bind(distributorController));
router.post('/:id/lock', distributorController.lockDistributor.bind(distributorController));
router.post('/:id/payment', distributorController.recordPayment.bind(distributorController));
router.get('/:id/history', distributorController.getDistributorHistory.bind(distributorController));

module.exports = router;
