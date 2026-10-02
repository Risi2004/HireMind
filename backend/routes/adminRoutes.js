const express = require('express');
const router = express.Router();
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const {
  getDemoAccounts,
  grantDemoAccess,
  refreshDemoQuota,
  cancelDemoAccess,
  getAllUsers,
} = require('../controllers/adminController');

// All Admin routes require authentication and Role === 'admin'
router.use(protect, requireAdmin);

// Demo Accounts Management
router.get('/demo-accounts', getDemoAccounts);
router.post('/demo-accounts/grant', grantDemoAccess);
router.post('/demo-accounts/refresh', refreshDemoQuota);
router.post('/demo-accounts/cancel', cancelDemoAccess);
router.post('/demo-accounts/revoke', cancelDemoAccess); // Alias for cancel

// Users Management
router.get('/users', getAllUsers);

module.exports = router;
