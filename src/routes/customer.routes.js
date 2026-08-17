const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const customerController = require('../controllers/customerController');

router.use(authenticate);
router.use(authorize('owner', 'staff'));

router.get('/', customerController.getCustomers.bind(customerController));
router.post('/', customerController.addCustomer.bind(customerController));
router.get('/:id', customerController.getCustomer.bind(customerController));
router.patch('/:id', customerController.updateCustomer.bind(customerController));
router.post('/:id/lock', customerController.lockCustomer.bind(customerController));
router.post('/:id/payment', customerController.recordPayment.bind(customerController));
router.get('/:id/history', customerController.getCustomerHistory.bind(customerController));
router.get('/:id/ledger', customerController.getCustomerLedger.bind(customerController));

module.exports = router;
