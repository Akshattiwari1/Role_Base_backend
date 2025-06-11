const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middlewares/authMiddleware'); // Correct import: singular 'middleware'
const {
  placeOrder,
  getMyOrders,
  getEnterpriseOrders,
  updateOrderStatus,
  getAllOrders,
} = require('../controllers/orderController');

// Buyer only
router.post('/', protect, authorizeRoles('buyer'), placeOrder);
router.get('/my-orders', protect, authorizeRoles('buyer'), getMyOrders);

// Enterprise only
router.get('/enterprise-orders', protect, authorizeRoles('enterprise'), getEnterpriseOrders);
router.put('/:id/status', protect, authorizeRoles('enterprise', 'admin'), updateOrderStatus);

// Admin only
router.get('/all', protect, authorizeRoles('admin'), getAllOrders);

module.exports = router;