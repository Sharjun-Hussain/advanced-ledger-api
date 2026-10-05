const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

router.post('/login', rateLimiter.authLimiter, authController.login.bind(authController));
router.post('/register', rateLimiter.authLimiter, authController.register.bind(authController));
router.post('/forgot-password', rateLimiter.authLimiter, authController.forgotPassword.bind(authController));
router.post('/reset-password', rateLimiter.authLimiter, authController.resetPassword.bind(authController));
router.patch('/change-password', authenticate, authController.changePassword.bind(authController));
router.get('/me', authenticate, authController.getMe.bind(authController));

module.exports = router;
