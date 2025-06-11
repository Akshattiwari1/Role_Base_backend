const express = require('express');
const protect = require('../middleware/authMiddleware');
const roleAccess = require('../middleware/roleMiddleware');
const {
  updateEnterpriseStatus,
  blockUser,
  unblockUser
} = require('../controllers/adminController');

const router = express.Router();

// Admin dashboard
router.get("/admin", protect, roleAccess('admin'), (req, res) => {
  res.json({ message: "Welcome Admin" });
});

// Accept/Reject Enterprise
router.post("/admin/enterprise-status", protect, roleAccess('admin'), updateEnterpriseStatus);

// Block user (buyer or enterprise)
router.post("/admin/block-user", protect, roleAccess('admin'), blockUser);

// Unblock user (buyer or enterprise)
router.post("/admin/unblock-user", protect, roleAccess('admin'), unblockUser);

// Enterprise dashboard
router.get("/enterprise", protect, roleAccess('admin', 'enterprise'), (req, res) => {
  res.json({ message: "Welcome Enterprise or Admin" });
});

// Buyer dashboard
router.get("/buyer", protect, roleAccess('admin', 'enterprise', 'buyer'), (req, res) => {
  res.json({ message: "Welcome Buyer" });
});

module.exports = router;
