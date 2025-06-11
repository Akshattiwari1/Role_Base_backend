const express = require('express');
const protect = require('../middlewares/authMiddleware');
const roleAccess = require('../middlewares/roleMiddleware');
const router = express.Router();

// Admin-only route
router.get("/admin", protect, roleAccess('admin'), (req, res) => {
  res.json({ message: "Welcome Admin" });
});

// Enterprise-only route
router.get("/enterprise", protect, roleAccess('admin', 'enterprise'), (req, res) => {
  res.json({ message: "Welcome Enterprise or Admin" });
});


// Buyer-only route
router.get("/buyer", protect, roleAccess('admin', 'enterprise','buyer'), (req, res) => {
  res.json({ message: "Welcome Buyer" });
});


module.exports = router;
