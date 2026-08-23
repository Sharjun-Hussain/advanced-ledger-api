const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const loanController = require('../controllers/loanController');

router.use(authenticate);
router.use(authorize('owner', 'staff'));

router.get('/', loanController.getLoans.bind(loanController));
router.post('/', loanController.addLoan.bind(loanController));
router.post('/:id/payment', loanController.recordLoanPayment.bind(loanController));
router.put('/:id', loanController.updateLoan.bind(loanController));
router.delete('/:id', loanController.deleteLoan.bind(loanController));

module.exports = router;
