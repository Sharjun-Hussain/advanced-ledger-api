const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const shopRoutes = require('./shop.routes');
const customerRoutes = require('./customer.routes');
const loanRoutes = require('./loan.routes');
const reminderRoutes = require('./reminder.routes');
const reportRoutes = require('./report.routes');
const customerAppRoutes = require('./customer.app.routes');
const adminRoutes = require('./admin.routes');
const distributorRoutes = require('./distributor.routes');
const textlkRoutes = require('./textlk.routes');

router.use('/auth', authRoutes);
router.use('/shop', shopRoutes);
router.use('/customers', customerRoutes);
router.use('/loans', loanRoutes);
router.use('/reminders', reminderRoutes);
router.use('/report', reportRoutes);
router.use('/customer', customerAppRoutes);
router.use('/admin', adminRoutes);
router.use('/distributors', distributorRoutes);
router.use('/sms', textlkRoutes);

module.exports = router;
