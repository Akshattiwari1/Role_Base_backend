const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middlewares/authMiddleware'); // Correct import: singular 'middleware'
const { getAllUsers, updateEnterpriseStatus, toggleUserBlock } = require('../controllers/adminController');

router.get('/users', protect, authorizeRoles('admin'), getAllUsers);
router.put('/enterprise/:id/status', protect, authorizeRoles('admin'), updateEnterpriseStatus);
router.put('/user/:id/block', protect, authorizeRoles('admin'), toggleUserBlock);

module.exports = router;