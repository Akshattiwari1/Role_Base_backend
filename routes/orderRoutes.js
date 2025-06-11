const express = require('express');
const protect = require('../middlewares/authMiddleware');
const roleAccess = require('../middlewares/roleMiddleware');

const router = express.Router();

// Example route - for testing
router.get('/', protect, roleAccess('admin', 'enterprise', 'buyer'), (req, res) => {
  res.json({ message: 'Orders fetched successfully based on role!' });
});

module.exports = router;
