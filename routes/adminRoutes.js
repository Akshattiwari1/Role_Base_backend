const express = require('express');
const { updateEnterpriseStatus, toggleUserBlock, getAllUsers } = require('../controllers/adminController');
const protect = require('../middlewares/authMiddleware');
const roleAccess = require('../middlewares/roleMiddleware');

const router = express.Router();

// All admin routes should be protected and only accessible by 'admin' role
// Route to get all users (for admin dashboard)
router.get('/users', protect, roleAccess('admin'), getAllUsers);

// Route to accept/reject an enterprise
// PUT /api/admin/enterprise/:id/status with body { "status": "approved" } or { "status": "rejected" }
router.put('/enterprise/:id/status', protect, roleAccess('admin'), updateEnterpriseStatus);

// Route to block/unblock a user (buyer or enterprise)
// PUT /api/admin/user/:id/block (toggles isBlocked status)
router.put('/user/:id/block', protect, roleAccess('admin'), toggleUserBlock);


module.exports = router;