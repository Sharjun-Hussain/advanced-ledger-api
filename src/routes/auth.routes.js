const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/login', authController.login.bind(authController));
router.post('/register', authController.register.bind(authController));
router.get('/me', authenticate, authController.getMe.bind(authController));

module.exports = router;
