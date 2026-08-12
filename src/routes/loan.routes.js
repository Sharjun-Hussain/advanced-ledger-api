const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const loanController = require('../controllers/loanController');

router.use(authenticate);
router.use(authorize('owner', 'staff'));

router.get('/', loanController.getLoans.bind(loanController));
router.post('/', loanController.addLoan.bind(loanController));
router.post('/:id/payment', loanController.recordLoanPayment.bind(loanController));

module.exports = router;
