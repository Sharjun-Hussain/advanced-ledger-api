const express = require('express');
const router = express.Router();
const chequeController = require('../controllers/chequeController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('owner', 'staff', 'admin'));

router.get('/', chequeController.getAllCheques);
router.get('/:id', chequeController.getChequeById);
router.post('/', chequeController.createCheque);
router.put('/:id/status', chequeController.updateChequeStatus);
router.delete('/:id', chequeController.deleteCheque);

module.exports = router;
